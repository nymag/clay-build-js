'use strict';
const through2 = require('through2');

/**
 * Browserify plugin to replace process.env with window.process.env
 * and extract all env var nams used
 * @param {object} b Browserify instance
 * @param {object} [opts] plugin options
 * @param {function} [opts.callback]
 */
function transformEnv(b, {callback}) {
  const env = [];

  b.pipeline.get('deps').push(through2.obj(function (item, enc, cb) {
    const matches = item.source.match(/process\.env\.(\w+)/ig);

    if (matches) {
      item.source = item.source.replace(/process\.env/ig, 'window.process.env'); // reference window, so browserify doesn't bundle in `process`
      // regex global flag doesn't give us back the actual key, so we need to grab it from the match
      matches.forEach(function (match) {
        env.push(match.match(/process\.env\.(\w+)/i)[1]);
      });
    }
    cb(null, item);
  }).on('end', () => {
    if (callback) callback(null, env);
  }));
}

module.exports = transformEnv;
