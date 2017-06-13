'use strict';
const _ = require('lodash'),
  toStream = require('string-to-stream');

/**
 * Generate the source code for a "models" module, which exports an array of model module IDs.
 * @param {object} b Browserify bundle object
 * @param {object} options
 * @param {string[]} options.entries Array of file entries
 * @param {string[]} options.cachedFiles Array of cached file entries
 * @return {object} stream
 */
function generateModelsSource(b, {entries = [], cachedFiles = []}) {
  const models = _.union(entries, cachedFiles)
    .filter(file => _.endsWith(file, 'model.js'))
    .map(file => ({
      file: file,
      name: file.split('/').slice(-2)[0]
    })),
    source = toStream('module.exports=' + JSON.stringify(models.map(m => m.name)));
  
  b.require(source, {expose: 'models'});
  return b;
}

module.exports = generateModelsSource;
