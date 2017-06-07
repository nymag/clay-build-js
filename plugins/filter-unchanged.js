'use strict';
const _ = require('lodash'),  
  through2 = require('through2');

/**
 * Browserify plugin to filter out any modules with source files that appear
 * in a specified array, EXCEPT entry files.
 * @param {object} b
 * @param {object} [opts]
 * @param {string[]} [opts.cachedFiles] Array of cached source files
 */
function filterUnchanged(b, {cachedFiles = []}) {
  const entries = [];

  // collect entry files
  b.pipeline.get('record').push(through2.obj(function (item, enc, cb) {
    entries.push(item.file);
    cb(null, item);
  }));

  b.pipeline.get('deps').push(through2.obj(function (item, enc, cb) {
    if (_.includes(cachedFiles, item.file) && !_.includes(entries, item.file)) {
      cb();
    } else {
      cb(null, item);
    }
  }));
}

module.exports = filterUnchanged;
