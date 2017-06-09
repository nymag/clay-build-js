'use strict';
const _ = require('lodash'),
  through2 = require('through2'),
  path = require('path');


/**
 * Browserify plugin to assign module IDs to each module, replacing Browserify's
 * built-in labeler. Ensures existing modules are assigned their current IDs.
 * @param {object} b
 * @param {object} [opts]
 * @param {object} [opts.cacheIds] Mapping of current filenames to module IDs
 * @returns {object} Browserify plugin
 */
function labeler(b, {cachedIds = {}}) {

  const generatedIds = _.assign({}, cachedIds),
    getOrGenerateId = file => generatedIds[file] || (generatedIds[file] = getModuleId(file) || i++);
  let i = _.max(_.values(generatedIds).filter(_.isFinite)) + 1 || 1;

  return b.pipeline.get('label').splice(0, 1, through2.obj(function (item, enc, cb) {
    item.id = getOrGenerateId(item.id);
    item.deps = _.mapValues(item.deps, (val, key) => key === 'dup' ? val : getOrGenerateId(val));
    cb(null, item);
  }));
}

/**
 * For a given file, return its module name.
 * @param {string} file
 * @return {string}
 */
function getModuleId(file) {
  // e.g. '/components/clay-paragraph/model.js' becomes 'clay-paragraph.model'
  if (_.endsWith(file, 'model.js')) {
    return file.split('/').slice(-2)[0] + '.model';
  // expose kiln plugin index file as 'kiln-plugins'
  } else if (file === path.resolve('./global/kiln-js/index.js')) {
    return 'kiln-plugins';
  // the models module (which is not an actual file) will appear to have a
  // source file called "models"
  } else if (file === 'models') {
    return file;
  }
}

module.exports = labeler;
