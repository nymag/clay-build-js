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
      mockFiles.create('a.js', "require('./b/model.js');require('./c/model.js');");
      mockFiles.create('b/model.js', 'module.exports=1;');
      mockFiles.create('c/model.js', 'module.exports=2;');
      mockFiles.create('d.js', 'module.exports=3;');
    });
    afterEach(function () {
      mockFiles.reset();
    });


    it('gives model.js files component-name.model IDs', function (done) {
      const bundler = browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn)
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(3);
          expect(unpacked[1].id).to.equal('b.model');
          expect(unpacked[2].id).to.equal('c.model');
          done();
        });
    });

    it('gives other files numeric IDs', function (done) {
      const bundler = browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn)
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked[0].id).to.equal(1);
          done();
        });
    });

    it('gives files the same IDs that they have in the cache', function (done) {
      let bundler;
      const cachedIds = {};

      cachedIds[mockFiles.path('a.js')] = 'foo';
      cachedIds[mockFiles.path('b/model.js')] = 'bar';

      bundler = browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn, {cachedIds})
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked[0].id).to.equal('foo');
          expect(unpacked[1].id).to.equal('bar');
          done();
        });
    });

    it('assigns new (non-cached) modules numeric IDs greater than the highest numeric ID in the cache', function (done) {
      const bundler = browserify()
        .add(mockFiles.path('a.js'))
        .add(mockFiles.path('d.js'))
        .plugin(fn, {
          cachedIds: {
            '/some/random/module': 100
          }
        })
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if(err) return done(err);
          expect(unpacked[0].id).to.equal(101);
          expect(unpacked[3].id).to.equal(102);
          done();
        });
    });
  });
});
