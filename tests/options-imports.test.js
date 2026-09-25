var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var babel = helpers.babel;
var plugin = helpers.plugin;
var transformWith = helpers.transformWith;
var stripInfernoImport = helpers.stripInfernoImport;
var expectValidJS = helpers.expectValidJS;

describe('Options and imports', function () {
  describe('imports option', function () {
    it('Should import from a custom module name', function () {
      expect(transformWith({imports: 'inferno-compat'}, '<div><Foo {...p}/>text<></></div>')).to.equal('import { createVNode, createFragment, createComponentVNode, normalizeProps, createTextVNode } from "inferno-compat";\ncreateVNode(1, "div", null, [normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n})), createTextVNode("text"), createFragment()], 4);');
    });

    it('Should treat the string "false" like false', function () {
      expect(transformWith({imports: 'false'}, '<div/>')).to.equal('var createVNode = Inferno.createVNode;\ncreateVNode(1, "div");');
    });

    it('Should treat the string "true" like true', function () {
      expect(transformWith({imports: 'true'}, '<div/>')).to.equal('import { createVNode } from "inferno";\ncreateVNode(1, "div");');
    });

    it('Should import from inferno when imports is omitted', function () {
      expect(transformWith({}, '<div/>')).to.equal('import { createVNode } from "inferno";\ncreateVNode(1, "div");');
    });

    it('Should import every used helper in one declaration', function () {
      expect(transformWith({imports: true}, '<div><Foo {...p}/>text<></></div>')).to.equal('import { createVNode, createFragment, createComponentVNode, normalizeProps, createTextVNode } from "inferno";\ncreateVNode(1, "div", null, [normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n})), createTextVNode("text"), createFragment()], 4);');
    });

    it('Should declare every used helper from the Inferno global in one var', function () {
      expect(transformWith({imports: false}, '<div><Foo {...p}/>text<></></div>')).to.equal('var createVNode = Inferno.createVNode,\n  createFragment = Inferno.createFragment,\n  createComponentVNode = Inferno.createComponentVNode,\n  normalizeProps = Inferno.normalizeProps,\n  createTextVNode = Inferno.createTextVNode;\ncreateVNode(1, "div", null, [normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n})), createTextVNode("text"), createFragment()], 4);');
    });

    it('Should insert the var after existing imports', function () {
      expect(transformWith({imports: false}, 'import {a} from "b";\nfunction f() { return <div><Foo/></div>; }\nconst g = () => <span/>;')).to.equal('import { a } from "b";\nvar createVNode = Inferno.createVNode,\n  createComponentVNode = Inferno.createComponentVNode;\nfunction f() {\n  return createVNode(1, "div", null, createComponentVNode(2, Foo), 2);\n}\nconst g = () => createVNode(1, "span");');
    });

    it('Should insert the var after directives and before other code', function () {
      expect(transformWith({imports: false}, '"use strict";\nfoo();\nfunction f() { return <div/>; }')).to.equal('"use strict";\n\nvar createVNode = Inferno.createVNode;\nfoo();\nfunction f() {\n  return createVNode(1, "div");\n}');
    });

    it('Should declare helpers before a call to a hoisted function that uses JSX', function () {
      expect(transformWith({imports: false}, 'render();\nfunction render() {\n  return <div/>;\n}')).to.equal('var createVNode = Inferno.createVNode;\nrender();\nfunction render() {\n  return createVNode(1, "div");\n}');
    });

    it('Should declare helpers after imports and before other code', function () {
      expect(transformWith({imports: false}, 'import a from "a";\nrender();\nfunction render() {\n  return <div/>;\n}')).to.equal('import a from "a";\nvar createVNode = Inferno.createVNode;\nrender();\nfunction render() {\n  return createVNode(1, "div");\n}');
    });

    it('Should declare helpers after a required Inferno', function () {
      expect(transformWith({imports: false}, 'var Inferno = require("inferno");\nfunction App() { return <div/>; }')).to.equal('var Inferno = require("inferno");\nvar createVNode = Inferno.createVNode;\nfunction App() {\n  return createVNode(1, "div");\n}');
    });

    it('Should declare helpers after an Inferno declaration that follows other code', function () {
      expect(transformWith({imports: false}, 'foo();\nconst Inferno = require("inferno");\nexport const a = <div/>;')).to.equal('foo();\nconst Inferno = require("inferno");\nvar createVNode = Inferno.createVNode;\nexport const a = createVNode(1, "div");');
    });

    it('Should ignore Inferno bindings in nested scopes', function () {
      expect(transformWith({imports: false}, 'function f() { var Inferno = x; return <div/>; }')).to.equal('var createVNode = Inferno.createVNode;\nfunction f() {\n  var Inferno = x;\n  return createVNode(1, "div");\n}');
    });

    it('Should declare helpers in every file compiled with a reused config', function () {
      var config = babel.loadOptionsSync({babelrc: false, configFile: false, plugins: [[plugin, {imports: false}]]});

      babel.transformSync('const a = <div/>;', config);
      expect(babel.transformSync('const b = <span/>;', config).code).to.equal('var createVNode = Inferno.createVNode;\nconst b = createVNode(1, "span");');
    });

    it('Should declare helpers in every file compiled with the same options object', function () {
      var config = {babelrc: false, configFile: false, plugins: [[plugin, {imports: false}]]};

      babel.transformSync('const a = <div/>;', config);
      expect(babel.transformSync('const b = <span/>;', config).code).to.equal('var createVNode = Inferno.createVNode;\nconst b = createVNode(1, "span");');
    });

    it('Should keep existing Inferno imports when declaring the var', function () {
      expect(transformWith({imports: false}, 'import * as Inferno from "inferno";\nexport const a = <div/>;')).to.equal('import * as Inferno from "inferno";\nvar createVNode = Inferno.createVNode;\nexport const a = createVNode(1, "div");');
    });

    it('Should not declare a var when pragma is set', function () {
      expect(transformWith({imports: false, pragma: 'h'}, '<div/>')).to.equal('h(1, "div");');
    });
  });

  describe('pragma options', function () {
    it('Should import every helper under its pragma name', function () {
      expect(transformWith({imports: true, pragma: 'cv', pragmaCreateComponentVNode: 'ccv', pragmaNormalizeProps: 'np', pragmaTextVNode: 'ctv', pragmaFragmentVNode: 'cf'}, '<div><Foo {...p}/>text<></></div>')).to.equal('import { createVNode as cv, createFragment as cf, createComponentVNode as ccv, normalizeProps as np, createTextVNode as ctv } from "inferno";\ncv(1, "div", null, [np(ccv(2, Foo, {\n  ...p\n})), ctv("text"), cf()], 4);');
    });

    it('Should call every helper by its pragma name without imports', function () {
      expect(transformWith({imports: false, pragma: 'cv', pragmaCreateComponentVNode: 'ccv', pragmaNormalizeProps: 'np', pragmaTextVNode: 'ctv', pragmaFragmentVNode: 'cf'}, '<div><Foo {...p}/>text<></></div>')).to.equal('cv(1, "div", null, [np(ccv(2, Foo, {\n  ...p\n})), ctv("text"), cf()], 4);');
    });

    it('Should declare default helper names when only a component pragma is set', function () {
      expect(transformWith({imports: false, pragmaCreateComponentVNode: 'ccv'}, '<div><Foo {...p}/>text<></></div>')).to.equal('var createVNode = Inferno.createVNode,\n  createFragment = Inferno.createFragment,\n  createComponentVNode = Inferno.createComponentVNode,\n  normalizeProps = Inferno.normalizeProps,\n  createTextVNode = Inferno.createTextVNode;\ncreateVNode(1, "div", null, [normalizeProps(ccv(2, Foo, {\n  ...p\n})), createTextVNode("text"), createFragment()], 4);');
    });
  });

  describe('defineAllArguments option', function () {
    it('Should define all component arguments', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<Foo/>'))).to.equal('createComponentVNode(2, Foo, null, null, null);');
    });

    it('Should accept the string "true"', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: 'true'}, '<Foo key="a"/>'))).to.equal('createComponentVNode(2, Foo, null, "a", null);');
    });

    it('Should define all element arguments', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<div className="c">x</div>'))).to.equal('createVNode(1, "div", "c", "x", 16, null, null, null);');
    });

    it('Should define all arguments of an empty short syntax fragment', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<></>'))).to.equal('createFragment(null, 1, null);');
    });

    it('Should define all arguments of a short syntax fragment with dynamic children', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<>{a}</>'))).to.equal('createFragment(a, 0, null);');
    });

    it('Should define all arguments of a short syntax fragment with static children', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<><div/></>'))).to.equal('createFragment([createVNode(1, "div", null, null, 1, null, null, null)], 4, null);');
    });

    it('Should define all arguments of an empty long syntax Fragment like short syntax', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<Fragment></Fragment>'))).to.equal('createFragment(null, 1, null);');
    });
  });

  describe('existing bindings', function () {
    it('Should use a top-level createVNode function instead of importing', function () {
      expect(transformWith({imports: true}, 'function createVNode(){}\nconst a = <div/>;')).to.equal('function createVNode() {}\nconst a = createVNode(1, "div");');
    });

    it('Should use createVNode imported from another module', function () {
      expect(transformWith({imports: true}, 'import {createVNode} from "other-lib";\nconst a = <div/>;')).to.equal('import { createVNode } from "other-lib";\nconst a = createVNode(1, "div");');
    });

    it('Should still import createVNode when it is imported under another name', function () {
      expect(transformWith({imports: true}, 'import {createVNode as cv} from "inferno";\nconst a = <div/>;')).to.equal('import { createVNode } from "inferno";\nimport { createVNode as cv } from "inferno";\nconst a = createVNode(1, "div");');
    });

    it('Should import createVNode next to a namespace import', function () {
      expect(transformWith({imports: true}, 'import * as Inferno from "inferno";\nconst a = <div/>;')).to.equal('import { createVNode } from "inferno";\nimport * as Inferno from "inferno";\nconst a = createVNode(1, "div");');
    });

    it('Should not import helpers that are already imported', function () {
      expect(transformWith({imports: true}, 'import {createVNode, createComponentVNode} from "inferno";\nconst a = <div><Foo/></div>;')).to.equal('import { createVNode, createComponentVNode } from "inferno";\nconst a = createVNode(1, "div", null, createComponentVNode(2, Foo), 2);');
    });

    it('Should ignore bindings named after other JSX runtimes', function () {
      expect(transformWith({imports: true}, 'const _jsx = 1, jsx = 2;\n<div/>;')).to.equal('import { createVNode } from "inferno";\nconst _jsx = 1,\n  jsx = 2;\ncreateVNode(1, "div");');
    });
  });

  describe('import emission', function () {
    it('Should not import anything without JSX', function () {
      expect(transformWith({imports: true}, 'const a = 1;')).to.equal('const a = 1;');
    });

    it('Should import once for many JSX roots', function () {
      expect(transformWith({imports: true}, 'const a = <div/>;\nconst b = <span/>;')).to.equal('import { createVNode } from "inferno";\nconst a = createVNode(1, "div");\nconst b = createVNode(1, "span");');
    });

    it('Should keep output on the original lines with retainLines', function () {
      expect(transformWith({imports: true}, 'const a = <div>\n  <span/>\n</div>;', {retainLines: true})).to.equal('import { createVNode } from "inferno";const a = createVNode(1, "div", null,\ncreateVNode(1, "span"), 2\n);');
    });

    it('Should require helpers in a file parsed as script by sourceType unambiguous', function () {
      expect(transformWith({imports: true}, 'const a = require("x");\nconst b = <div/>;', {sourceType: 'unambiguous'})).to.equal('var _inferno = require("inferno"),\n  createVNode = _inferno.createVNode;\nconst a = require("x");\nconst b = createVNode(1, "div");');
    });

    it('Should import helpers in a file parsed as module by sourceType unambiguous', function () {
      expect(transformWith({imports: true}, 'import x from "x";\nconst b = <div/>;', {sourceType: 'unambiguous'})).to.equal('import { createVNode } from "inferno";\nimport x from "x";\nconst b = createVNode(1, "div");');
    });

    it('Should require every used helper in a script', function () {
      var code = transformWith({imports: true}, 'const a = <div><Foo {...p}/>text<></></div>;', {sourceType: 'script'});

      expect(code).to.equal('var _inferno = require("inferno"),\n  createVNode = _inferno.createVNode,\n  createFragment = _inferno.createFragment,\n  createComponentVNode = _inferno.createComponentVNode,\n  normalizeProps = _inferno.normalizeProps,\n  createTextVNode = _inferno.createTextVNode;\nconst a = createVNode(1, "div", null, [normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n})), createTextVNode("text"), createFragment()], 4);');
      expectValidJS(code, 'script');
    });

    it('Should require helpers after directives in a script', function () {
      expect(transformWith({imports: true}, '"use strict";\nconst a = <div/>;', {sourceType: 'script'})).to.equal('"use strict";\n\nvar _inferno = require("inferno"),\n  createVNode = _inferno.createVNode;\nconst a = createVNode(1, "div");');
    });

    it('Should require helpers from a custom module name in a script', function () {
      expect(transformWith({imports: 'inferno-compat'}, 'const a = <div/>;', {sourceType: 'script'})).to.equal('var _infernoCompat = require("inferno-compat"),\n  createVNode = _infernoCompat.createVNode;\nconst a = createVNode(1, "div");');
    });

    it('Should require helpers under their pragma names in a script', function () {
      expect(transformWith({imports: true, pragma: 'cv'}, 'const a = <div><Foo/></div>;', {sourceType: 'script'})).to.equal('var _inferno = require("inferno"),\n  cv = _inferno.createVNode,\n  createComponentVNode = _inferno.createComponentVNode;\nconst a = cv(1, "div", null, createComponentVNode(2, Foo), 2);');
    });

    it('Should not require helpers that are already declared in a script', function () {
      expect(transformWith({imports: true}, 'function createVNode() {}\nconst a = <div><Foo/></div>;', {sourceType: 'script'})).to.equal('var _inferno = require("inferno"),\n  createComponentVNode = _inferno.createComponentVNode;\nfunction createVNode() {}\nconst a = createVNode(1, "div", null, createComponentVNode(2, Foo), 2);');
    });

    it('Should use a unique name for the required module in a script', function () {
      expect(transformWith({imports: true}, 'var _inferno = 1;\nconst a = <div/>;', {sourceType: 'script'})).to.equal('var _inferno2 = require("inferno"),\n  createVNode = _inferno2.createVNode;\nvar _inferno = 1;\nconst a = createVNode(1, "div");');
    });
  });

  // JSX pragma comments are not supported; they stay in the output unchanged
  describe('pragma comments', function () {
    it('Should ignore @jsx and @jsxFrag comments', function () {
      expect(transformWith({imports: true}, '/** @jsx h */\n/** @jsxFrag F */\n<><div/></>')).to.equal('import { createVNode, createFragment } from "inferno";\n/** @jsx h */\n/** @jsxFrag F */\ncreateFragment([createVNode(1, "div")], 4);');
    });

    it('Should ignore @jsxRuntime and @jsxImportSource comments', function () {
      expect(transformWith({imports: true}, '/** @jsxRuntime classic */\n/** @jsxImportSource preact */\n<div/>')).to.equal('import { createVNode } from "inferno";\n/** @jsxRuntime classic */\n/** @jsxImportSource preact */\ncreateVNode(1, "div");');
    });
  });

  describe('current behaviour (questionable)', function () {
    // The generated call resolves to the local constant
    it('Should not detect a local binding that shadows createVNode', function () {
      expect(transformWith({imports: true}, 'function f(){ const createVNode = 1; return <div/>; }')).to.equal('import { createVNode } from "inferno";\nfunction f() {\n  const createVNode = 1;\n  return createVNode(1, "div");\n}');
    });

    // Babel annotates generated calls with /*#__PURE__*/ for tree-shaking
    it('Should not add pure annotations to generated calls', function () {
      var code = transformWith({imports: true}, '<div><Foo/></div>');

      expect(code).to.not.contain('__PURE__');
    });

    it('Should ignore unknown options', function () {
      expect(transformWith({imports: true, pragmaa: 'x'}, '<div/>')).to.equal('import { createVNode } from "inferno";\ncreateVNode(1, "div");');
    });
  });
});
