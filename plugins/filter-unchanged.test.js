'use strict';
const sinon = require('sinon'),
  expect = require('chai').expect,
  dirname = __dirname.split('/').pop(),
  filename = __filename.split('/').pop().split('.').shift(),
  fs = require('fs'),
  plugin = require('./' + filename),
  browserify = require('browserify');

describe(dirname, function () {
  describe(filename, function () {
    let sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(fs, 'readFile');
      sandbox.stub(fs, 'writeFile');
    });
    afterEach(function () {
      sandbox.restore();
    });

    it('removes cached files', function (done) {
      const bundler = browserify();

      fs.readFile.callsFake(function (a, b, c) {
        console.log(a, b, c);
        return 'test';
      });

      console.log('go bundle');
      bundler.bundle()
        .on('error', (err)=>{
          console.log(err);
          done();
        })
        .on('end', () => {
          console.log('done');
          done();
        });
    });
  });
});


