'use strict';
const fs = require('fs-extra'),
  path = require('path'), 
  browserify = require('browserify'),
  glob = require('glob'),
  babelify = require('babelify'),
  babelPresetES2015 = require('babel-preset-es2015'),
  babelCommonJS = require('babel-plugin-transform-es2015-modules-commonjs'),
  browserifySplitter = require('browserify-splitter'),
  browserifyExtractRegistry = require('browserify-extract-registry'),
  browserifyExtractIds = require('browserify-extract-ids'),
  bundleCollapser = require('bundle-collapser/plugin'),
  _ = require('lodash'),
  Gaze = require('gaze').Gaze,
  vueify = require('vueify'),
  extractCSS = require('vueify/plugins/extract-css'),
  plugins = {
    filterUnchanged: require('./plugins/filter-unchanged'),
    labeler: require('./plugins/labeler'),
    generateModelsSource: require('./plugins/generate-models-source'),
    transformEnv: require('./plugins/transform-env')
  },
  ENTRY_GLOBS = [
    'components/*/model.js',
    'components/*/controller.js',
    './global/kiln-js/index.js'
  ];

/**
 * Browserify.bundle(), but as a Promise
 * @param {} bundler 
 */
function promiseBundle(bundler, opts) {
  return new Promise(function(resolve, reject) {
    bundler.bundle(opts)
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
 * Update the megabundle with changes from filepaths.
 * @param {string[]} filepaths Filepaths of files that need built or updated
 * @param {object} [opts] See build opts
 * @param {object} [cache] Tracks data between builds so we don't need to do full rebuild on each change
 * @param {object} [cache.ids] Map of absolute source file paths to module IDs
 * @param {string[]} [cache.env] Array of env vars used
 * @param {object} [cache.registry] Dependency registry. Maps each module ID to an array of dependency IDs
 * @param {string[]} [cache.files] Array of all source files represented in the megabundle.
 * @returns {Promise}
 */
function compileScripts(filepaths, conf, cache = {}) {
  const entries = filepaths.map(file => path.resolve(file)),
    subcache = {},
    bundler = browserify({
      dedupe: false,
      baseDir: conf.baseDir
    });

  _.defaults(cache, {
    ids: {},
    env: [],
    registry: {},
    files: []
  });

  if (conf.verbose) console.log('updating megabundle, options = ', conf);

  bundler
    .require(entries)
    // Transpile to ES5
    .transform(babelify.configure(conf.babelConf))
    // Transform behavior and pane .vue files
    .transform(vueify, {babel: conf.babelConf})
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
      writeToDir: conf.outputDir,
      verbose: conf.verbose
    })
     // Transform process.env into window.process.env and export array of env vars
    .plugin(plugins.transformEnv, {
      callback: (err, env) => {
        if (err) return console.error(err);
        subcache.env = env;
      }
    });

  if (!conf.debug) {
    bundler
      // Uglify everything
      .transform('uglifyify', {
        global: true,
        sourceMap: false,
        output: {
          inline_script: true
        }})
      // Shorten bundle size by rewriting require calls to use actual module IDs
      // instead of file paths
      .plugin(bundleCollapser);
  }

  return conf.preBundle(bundler)
    .then(() => promiseBundle(bundler))
    .then(() => {
        if (conf.debug) console.log(cache.ids);
        // merge the subcache into the cache; overwrite, but never delete
        mergeSubcache(subcache, cache);

        // export registry and env vars
        fs.outputJsonSync(conf.registryPath, cache.registry);
        fs.outputJsonSync(conf.envPath, cache.env);
        if (conf.verbose) console.log('megabundle updated');
    });
}

/**
 * Add default options.
 * @param {object} opts 
 * @return {object}
 */
function defaults(opts = {}) {
  let conf = _.defaults({}, opts, {
    debug: false,
    verbose: false,
    preBundle: () => Promise.resolve(),
    babelConf: {
      presets: [babelPresetES2015],
      plugins: [babelCommonJS]
    },
    baseDir: process.cwd()
  });

  // these depend on how baseDir is set and so must be separate
  conf = _.defaults(conf, {
    registryPath: path.resolve(conf.baseDir, 'public', 'js', 'registry.json'),
    outputDir: path.resolve(conf.baseDir, 'public', 'js'),
    envPath: path.resolve(conf.baseDir, 'client-env.json')
  });
  return conf;
}

/**
 * Return all the entry files for a Clay installation at baseDir
 * @param {string} baseDir
 * @return {string[]} Absolute file paths to entry files
 */
function getEntries(baseDir, ENTRY_GLOBS) {
  return ENTRY_GLOBS
    .reduce((prev, pattern) => {
      return prev.concat(glob.sync(pattern, {
        cwd: baseDir,
        absolute: true
      }));
    }, []);
}

/**
 * Build the megabundle, and optionally watch for changes.
 * @param {object} [opts]
 * @param {boolean} [opts.debug] Skip uglify for faster bundling
 * @param {boolean} [opts.verbose] Log file writes
 * @param {boolean} [opts.watch] Rebuild on changes to megabundle source files
 * @param {string} [opts.baseDir] Root of Clay installation
 * @param {string} [opts.registryPath] Export path of dependency registry
 * @param {string} [opts.outputDir] Export directory of module chunks
 * @param {string} [opts.envPath] Export path of environmental variable file
 * @param {function} [opts.preBundle] Function to run before bundling. First arg is Browserify bundler
 * @param {function} [opts.babelConf] Configuration object for Babel.
 * @returns {Promise}
 */
function build(opts) {
  const conf = defaults(opts),
    cache = {},
    entries = getEntries(conf.baseDir, ENTRY_GLOBS);

  return compileScripts(entries, conf, cache)
    .then(() => {
      if (conf.watch) {
        startWatching(cache, conf);
      }
      return cache;
    });
}

module.exports = build;
