/*

A simple lib for writing mock files to test/mock-files/

Everything is synchronous.

*/

const path = require('path'),
  fs = require('fs-extra'),
  BASE_DIR = 'mock-files';

// Create a file in the "sandbox" directory with contents
module.exports.create = (file, contents) => fs.outputFileSync(path.join(__dirname,  BASE_DIR, file), contents);

// Delete all test mock files
module.exports.reset = () => fs.emptyDirSync(path.join(__dirname, BASE_DIR));

// Return the absolute path of the specified mock file
module.exports.path = (file) => path.resolve(path.join(__dirname, BASE_DIR, file));
