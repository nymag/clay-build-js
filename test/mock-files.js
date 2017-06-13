/*

A simple lib for writing mock files to test/mock-files/

Everything is synchronous.

*/

'use strict';
const path = require('path'),
  fs = require('fs-extra'),
  BASE_DIR = path.join(__dirname, 'mock-files');

// Create a file in the "sandbox" directory with contents
module.exports.create = (file, contents) => fs.outputFileSync(path.join(BASE_DIR, file), contents);

// Delete all test mock files
module.exports.reset = () => fs.emptyDirSync(BASE_DIR);

module.exports.read = (file) => fs.readFileSync(path.join(BASE_DIR, file));

// Return the absolute path of the specified mock file
module.exports.path = (file) => file ? path.resolve(path.join(BASE_DIR, file)) : BASE_DIR;
