'use strict';
const fs = require('fs-extra'),
  path = require('path'), 
  browserify = require('browserify'),
  glob = require('glob'),
  babelify = require('babelify'),
  browserifySplitter = require('browserify-splitter'),
  browserifyExtractRegistry = require('browserify-extract-registry'),
  browserifyExtractIds = require('browserify-extract-ids'),
  bundleCollapser = require('bundle-collapser/plugin'),
  _ = require('lodash'),
  gaze = require('gaze'),
  vueify = require('vueify'),
  extractCSS = require('vueify/plugins/extract-css'),
  plugins = {
    filterUnchanged: require('./plugins/filter-unchanged'),
    labeler: require('./plugins/labeler'),
    generateModelsSource: require('./plugins/generate-models-source'),
    transformEnv: require('./plugins/transform-env')
  },
  REGISTRY_PATH = path.resolve('.', 'public', 'js', 'registry.json'),
  MEGABUNDLE_DIR = path.resolve('.', 'public', 'js'),
  ENV_PATH = path.resolve('.', 'client-env.json'),
  // paths or globs to megabundle entry files
  ENTRY_GLOBS = [
    'components/*/model.js',
    'components/*/controller.js',
    './global/kiln-js/index.js'
  ];

/**
 * Browserify.bundle(), but as a Promise
 * @param {} bundler 
 */
function promiseBundle(bundler) {
  return new Promise(function(resolve, reject) {
    bundler.bundle()
      .on('end', () => resolve())
      .on('error', reject)
      .resume(); // force the bundle read-stream to flow
  });
}

/**
 * Merge the subcache into the cache.
 * @param {object} subcache 
 * @param {object} cache 
 */
function mergeSubcache(subcache, cache) {
  _.assign(cache.registry, subcache.registry);
  _.assign(cache.ids, subcache.ids);
  cache.files = _.union(subcache.files, cache.files);
  cache.env = _.union(subcache.env, cache.env);
}

/**
 * Start watching files
 * @param {string[]} files File paths or globs to watch
 * @param {function} onUpdate Gets updated/added file path and watcher object
 */
function startWatching(files, onUpdate) {
  gaze(files, (err, watcher) => {
    if (err) console.error(err);
    watcher.on('changed', (file) => onUpdate && onUpdate(file, watcher));
    watcher.on('added', (file) => onUpdate && onUpdate(file, watcher));
  });
}

/**
 * Update the megabundle with changes from filepaths.
 * @param {string[]} filepaths Filepaths of files that need built or updated
 * @param {object} [opts]
 * @param {boolean} [opts.debug] Disables uglify and bundle-collapse
 * @param {boolean} [opts.verbose] Logs file writes
 * @param {function} [opts.preBundle] Function to run before bundling. First arg is Browserify bundler
 * @param {function} [opts.babelConf] Configuration object for Babel.
 * @param {object} [cache] Tracks data between builds so we don't need to do full rebuild on each change
 * @param {object} [cache.ids] Map of absolute source file paths to module IDs
 * @param {string[]} [cache.env] Array of env vars used
 * @param {object} [cache.registry] Dependency registry. Maps each module ID to an array of dependency IDs
 * @param {string[]} [cache.files] Array of all source files represented in the megabundle.
 * @returns {Promise}
 */
function compileScripts(filepaths, opts, cache = {}) {
  const entries = filepaths.map(file => path.resolve(file)),
    subcache = {},
    bundler = browserify({
      dedupe: false
    });

  opts = _.defaults({}, opts, {
    debug: false,
    verbose: false,
    preBundle: Promise.resolve(),
    babelConf: {
      presets: ['es2015'],
      plugins: ['trasnform-es2015-module-commonjs']
    }
  });

  _.defaults(cache, {
    ids: {},
    env: [],
    registry: {},
    files: []
  });

  if (opts.verbose) console.log('updating megabundle, options = ', opts);

  bundler
    .require(entries)
    // Transpile to ES5
    .transform(babelify.configure(babelConf))
    // Transform behavior and pane .vue files
    .transform(vueify, {babel: babelConf})
    // Generate the "models" module; allows edit-after to fetch all model names with
    // require('models')
    .plugin(plugins.generateModelsSource, {
      entries,
      cachedFiles: cache.files
    })
    .plugin(extractCSS, {
      out: 'public/css/edit-before.css'
    })
    // Assign each module a module ID, defaulting to old module IDs in cache
    .plugin(plugins.labeler, {cachedIds: cache.ids})
    // Keep only entry (changed) files and new files; do not process existing, unchanged files
    .plugin(plugins.filterUnchanged, {cachedFiles: cache.files})
    // Extract the registry, an object mapping each module's IDs to an array of its
    // dependencies' IDs.
    .plugin(browserifyExtractRegistry, {
      callback: (err, data) => {
        if (err) return console.error(err);
        subcache.registry = data;
      }
    })
    // Extract module IDs, a map of source file paths to module IDs.
    // Not necessary to generate the whole megabundle, but used on updates.
    .plugin(browserifyExtractIds, {
      callback: (err, ids) => {
        if (err) return console.error(err);
        subcache.ids = ids;
        subcache.files = _.keys(ids);
      }
    })
    // Write out each chunk of the browser-pack bundle in such a way
    // that module chunks can be concatenated together arbitrarily
    .plugin(browserifySplitter, {
      writeToDir: MEGABUNDLE_DIR,
      verbose: opts.verbose
    })
     // Transform process.env into window.process.env and export array of env vars
    .plugin(plugins.transformEnv, {
      callback: (err, env) => {
        if (err) return console.error(err);
        subcache.env = env;
      }
    });

  if (!opts.debug) {
    bundler
      // Uglify everything
      .transform({
        global: true,
        output: {
          inline_script: true
        }}, 'uglifyify')
      // Shorten bundle size by rewriting require calls to use actual module IDs
      // instead of file paths
      .plugin(bundleCollapser);
  }

  return Promise.resolve(opts.preBundle(bundler))
    .then(() => promiseBundle(bundler))
    .then(() => {
        if (opts.debug) console.log(cache.ids);
        // merge the subcache into the cache; overwrite, but never delete
        mergeSubcache(subcache, cache);
        // export registry and env vars
        fs.outputJsonSync(REGISTRY_PATH, cache.registry);
        fs.outputJsonSync(ENV_PATH, cache.env);
        if (opts.verbose) console.log('megabundle updated');
    });
}

/**
 * Build the megabundle, and optionally watch for changes.
 * @param {object} [opts]
 * @param {boolean} [opts.debug] Skip uglify for faster bundling
 * @param {boolean} [opts.verbose] Log file writes
 * @param {boolean} [opts.watch] Rebuild on changes to megabundle source files
 * @returns {Promise}
 */
function build(opts = {}) {
  const entries = ENTRY_GLOBS.reduce((prev, pattern) => prev.concat(glob.sync(pattern)), []),
    cache = {};

  return compileScripts(entries, opts, cache)
    .then(()=>{
      if (opts.watch) {
        // start watching all files in the bundle and entry file locations
        const filesToWatch = cache.files.concat(ENTRY_GLOBS);

        startWatching(filesToWatch, (file, watcher) => {
          compileScripts([file], opts, (err) => {
            if (err) console.error(err);
            watcher.add(_.keys(cache.ids)); // watch new files
          });
        });
      }
    });
}

module.exports = build;
