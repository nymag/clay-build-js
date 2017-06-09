'use strict';
const sinon = require('sinon'),
  expect = require('chai').expect,
  path = require('path'),
  fs = require('fs'),
  browserify = require('browserify'),
  mockFiles = require('../test/mock-files'),
  dirname = __dirname.split('/').pop(),
  filename = __filename.split('/').pop().split('.').shift(),
  fn = require('./' + filename),
  unpack = require('browser-unpack');

describe(dirname, function () {
  describe(filename, function () {
    beforeEach(function () {
      mockFiles.create('a.js', "require('./b/model.js');require('./c/model.js')")
      mockFiles.create('b/model.js', 'module.exports=1');
      mockFiles.create('c/model.js', 'module.exports=2');
    });
    afterEach(function () {
      mockFiles.reset();
    });


    it('generates a models module with the correct module IDs', function (done) {
      const bundler = browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn, {
          entries: ['a.js', 'b/model.js', 'c/model.js']
        })
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(4);
          expect(unpacked[3].source).to.equal('module.exports=["b","c"]');
          expect(unpacked[3].id).to.equal('models');
          done();
        });
    });

    it('merges entries with cachedFiles', function (done) {
      const bundler = browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn, {
          entries: ['a.js', 'b/model.js'],
          cachedFiles: ['c/model.js']
        })
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(4);
          expect(unpacked[3].source).to.equal('module.exports=["b","c"]');
          expect(unpacked[3].id).to.equal('models');
          done();
        });
    });

  it('dedupes overlap between entries and cachedFiles', function (done) {
      const bundler = browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn, {
          entries: ['a.js', 'b/model.js', 'c/model.js'],
          cachedFiles: ['c/model.js']
        })
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(4);
          expect(unpacked[3].source).to.equal('module.exports=["b","c"]');
          expect(unpacked[3].id).to.equal('models');
          done();
        });
    });

    it('generates a module even if given no entries', function (done) {
      const bundler = browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn)
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(4);
          expect(unpacked[3].source).to.equal('module.exports=[]');
          expect(unpacked[3].id).to.equal('models');
          done();
        });
    });    
  });
});
