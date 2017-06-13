'use strict';
const expect = require('chai').expect,
  browserify = require('browserify'),
  mockFiles = require('../test/mock-files'),
  dirname = __dirname.split('/').pop(),
  filename = __filename.split('/').pop().split('.').shift(),
  fn = require('./' + filename),
  unpack = require('browser-unpack');

describe(dirname, function () {
  describe(filename, function () {
    const srcA = "require('./b.js')",
      srcB = 'module.exports=1',
      srcC = 'module.exports=2';

    beforeEach(()=> {
      mockFiles.create('a.js', srcA);
      mockFiles.create('b.js', srcB);
      mockFiles.create('c.js', srcC);
    });
    afterEach(function () {
      mockFiles.reset();
    });

    it('does not filter out anything if cachedFiles is not set', function (done) {
      browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn)
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(2);
          expect(unpacked[0].source).to.equal(srcA);
          expect(unpacked[1].source).to.equal(srcB);
          done();
        });
    });

    it('filters out files included in cachedFiles', function (done) {
      browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn, {
          cachedFiles: [
            mockFiles.path('b.js'),
            mockFiles.path('c.js')
          ]
        })
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(1);
          expect(unpacked[0].source).to.equal(srcA);
          done();
        });
    });

    it('does not filter out entry files, even if they are in cachedFiles', function (done) {
      browserify()
        .add(mockFiles.path('a.js'))
        .add(mockFiles.path('b.js'))
        .plugin(fn, {
          cachedFiles: [
            mockFiles.path('a.js'),
            mockFiles.path('b.js'),
            mockFiles.path('c.js')
          ]
        })
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked.length).to.equal(2);
          expect(unpacked[0].source).to.equal(srcA);
          expect(unpacked[1].source).to.equal(srcB);
          done();
        });
    });
  });
});
