'use strict';

const build = require('../index') ,
  mockFiles = require('./mock-files'),
  sinon = require('sinon'),
  fs = require('fs-extra'),
  expect = require('chai').expect;

describe('build', function () {

  describe('basic functionality', function () {

    before(function () {
      mockFiles.reset();
      mockFiles.create('components/a/model.js', 'module.exports=1; console.log(process.env.FOO);');
      mockFiles.create('components/b/model.js', "module.exports=require('../../lib.js')");
      mockFiles.create('lib.js', 'module.exports=2');
      return build({
        baseDir: mockFiles.path(),
      });
    });

    after(function () {
      mockFiles.reset();
    });

    it('outputs a chunk for each model.js', function () {
      mockFiles.read('public/js/a.model.js');
      mockFiles.read('public/js/b.model.js');
    });

    it('outputs a chunk for each dependency', function () {
      mockFiles.read('public/js/1.js');
    });

    it('outputs prelude.js and postlude.js', function () {
      mockFiles.read('public/js/prelude.js'),
      mockFiles.read('public/js/postlude.js');
    });

    it('outputs models.js', function () {
      mockFiles.read('public/js/models.js');
    });

    it('outputs registry.json with correct data', function () {
      const registry = fs.readJsonSync(mockFiles.path('public/js/registry.json'));

      expect(registry).to.eql({
        1: [],
        2: [],
        'a.model': [1],
        'b.model': [2],
        models: []
      });
    });

    it('outputs client-env.json with correct data', function () {
      const clientEnv = fs.readJsonSync(mockFiles.path('client-env.json'));

      expect(clientEnv).to.eql(['FOO']);
    });
  });

  describe('preBundle option', function () {
    let util = {test: () => Promise.resolve()};

    before(function () {
      sinon.spy(util, 'test');
      mockFiles.reset();
      mockFiles.create('components/a/model.js', 'module.exports=1');
      return build({
        baseDir: mockFiles.path(),
        preBundle: () => util.test()
      });
    });

    it('calls prebundle function', function () {
      expect(util.test.calledOnce).to.equal(true);
    });
  });

});
