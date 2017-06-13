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
    before(function () {
      mockFiles.create('a.js', "require('./b/model.js');require('./c/model.js');");
      mockFiles.create('b/model.js', 'module.exports=process.env.FOO;');
      mockFiles.create('c/model.js', 'module.exports=[process.env.BAR,process.env.BAZ];');
    });
    after(function () {
      mockFiles.reset();
    });

    it('exposes used env vars in plugin callback', function (done) {
      browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn, {
          callback: (err, env) => {
            if (err) return done(err);
            expect(env.length).to.equal(3);
            expect(env).to.include('BAR');
            expect(env).to.include('FOO');
            expect(env).to.include('BAZ');
            done();
          }
        })
        .bundle((err) => {
          if (err) return done(err);
        });
    });

    it('rewrites process.env to window.process.env', function (done) {
      browserify()
        .add(mockFiles.path('a.js'))
        .plugin(fn)
        .bundle((err, contents) => {
          const unpacked = unpack(contents);

          if (err) return done(err);
          expect(unpacked[2].source).to.include('window.process.env.FOO');
          expect(unpacked[3].source).to.include('window.process.env.BAR');
          expect(unpacked[3].source).to.include('window.process.env.BAZ');
          done();
        });
    });
  });
});
