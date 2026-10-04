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
var transformTSX = helpers.transformTSX;
var es5CommonJS = helpers.es5CommonJS;

describe('Options and imports', function () {
  describe('imports option', function () {
    it('Should import from a custom module name', function () {
      expect(transformWith({imports: 'inferno-compat'}, '<div><Foo {...p}/>text<></></div>')).to.equal('import { newVNode, newFragment, newComponentVNode, normalizeProps, newTextVNode } from "inferno-compat";\nnewVNode(5, "div", null, [normalizeProps(newComponentVNode(0, Foo, {\n  ...p\n})), newTextVNode("text"), newFragment(272)]);');
    });

    it('Should treat the string "false" like false', function () {
      expect(transformWith({imports: 'false'}, '<div/>')).to.equal('var newVNode = Inferno.newVNode;\nnewVNode(17, "div");');
    });

    it('Should treat the string "true" like true', function () {
      expect(transformWith({imports: 'true'}, '<div/>')).to.equal('import { newVNode } from "inferno";\nnewVNode(17, "div");');
    });

    it('Should import from inferno when imports is omitted', function () {
      expect(transformWith({}, '<div/>')).to.equal('import { newVNode } from "inferno";\nnewVNode(17, "div");');
    });

    it('Should import every used helper in one declaration', function () {
      expect(transformWith({imports: true}, '<div><Foo {...p}/>text<></></div>')).to.equal('import { newVNode, newFragment, newComponentVNode, normalizeProps, newTextVNode } from "inferno";\nnewVNode(5, "div", null, [normalizeProps(newComponentVNode(0, Foo, {\n  ...p\n})), newTextVNode("text"), newFragment(272)]);');
    });

    it('Should declare every used helper from the Inferno global in one var', function () {
      expect(transformWith({imports: false}, '<div><Foo {...p}/>text<></></div>')).to.equal('var newVNode = Inferno.newVNode,\n  newFragment = Inferno.newFragment,\n  newComponentVNode = Inferno.newComponentVNode,\n  normalizeProps = Inferno.normalizeProps,\n  newTextVNode = Inferno.newTextVNode;\nnewVNode(5, "div", null, [normalizeProps(newComponentVNode(0, Foo, {\n  ...p\n})), newTextVNode("text"), newFragment(272)]);');
    });

    it('Should insert the var after existing imports', function () {
      expect(transformWith({imports: false}, 'import {a} from "b";\nfunction f() { return <div><Foo/></div>; }\nconst g = () => <span/>;')).to.equal('import { a } from "b";\nvar newVNode = Inferno.newVNode,\n  newComponentVNode = Inferno.newComponentVNode;\nfunction f() {\n  return newVNode(9, "div", null, newComponentVNode(0, Foo));\n}\nconst g = () => newVNode(17, "span");');
    });

    it('Should insert the var after directives and before other code', function () {
      expect(transformWith({imports: false}, '"use strict";\nfoo();\nfunction f() { return <div/>; }')).to.equal('"use strict";\n\nvar newVNode = Inferno.newVNode;\nfoo();\nfunction f() {\n  return newVNode(17, "div");\n}');
    });

    it('Should declare helpers before a call to a hoisted function that uses JSX', function () {
      expect(transformWith({imports: false}, 'render();\nfunction render() {\n  return <div/>;\n}')).to.equal('var newVNode = Inferno.newVNode;\nrender();\nfunction render() {\n  return newVNode(17, "div");\n}');
    });

    it('Should declare helpers after imports and before other code', function () {
      expect(transformWith({imports: false}, 'import a from "a";\nrender();\nfunction render() {\n  return <div/>;\n}')).to.equal('import a from "a";\nvar newVNode = Inferno.newVNode;\nrender();\nfunction render() {\n  return newVNode(17, "div");\n}');
    });

    it('Should declare helpers after a required Inferno', function () {
      expect(transformWith({imports: false}, 'var Inferno = require("inferno");\nfunction App() { return <div/>; }')).to.equal('var Inferno = require("inferno");\nvar newVNode = Inferno.newVNode;\nfunction App() {\n  return newVNode(17, "div");\n}');
    });

    it('Should declare helpers after an Inferno declaration that follows other code', function () {
      expect(transformWith({imports: false}, 'foo();\nconst Inferno = require("inferno");\nexport const a = <div/>;')).to.equal('foo();\nconst Inferno = require("inferno");\nvar newVNode = Inferno.newVNode;\nexport const a = newVNode(17, "div");');
    });

    it('Should ignore Inferno bindings in nested scopes', function () {
      expect(transformWith({imports: false}, 'function f() { var Inferno = x; return <div/>; }')).to.equal('var newVNode = Inferno.newVNode;\nfunction f() {\n  var Inferno = x;\n  return newVNode(17, "div");\n}');
    });

    it('Should declare helpers in every file compiled with a reused config', function () {
      var config = babel.loadOptionsSync({babelrc: false, configFile: false, plugins: [[plugin, {imports: false}]]});

      babel.transformSync('const a = <div/>;', config);
      expect(babel.transformSync('const b = <span/>;', config).code).to.equal('var newVNode = Inferno.newVNode;\nconst b = newVNode(17, "span");');
    });

    it('Should declare helpers in every file compiled with the same options object', function () {
      var config = {babelrc: false, configFile: false, plugins: [[plugin, {imports: false}]]};

      babel.transformSync('const a = <div/>;', config);
      expect(babel.transformSync('const b = <span/>;', config).code).to.equal('var newVNode = Inferno.newVNode;\nconst b = newVNode(17, "span");');
    });

    it('Should keep existing Inferno imports when declaring the var', function () {
      expect(transformWith({imports: false}, 'import * as Inferno from "inferno";\nexport const a = <div/>;')).to.equal('import * as Inferno from "inferno";\nvar newVNode = Inferno.newVNode;\nexport const a = newVNode(17, "div");');
    });

    it('Should not declare a var when pragma is set', function () {
      expect(transformWith({imports: false, pragma: 'h'}, '<div/>')).to.equal('h(17, "div");');
    });
  });

  describe('pragma options', function () {
    it('Should import every helper under its pragma name', function () {
      expect(transformWith({imports: true, pragma: 'cv', pragmaCreateComponentVNode: 'ccv', pragmaNormalizeProps: 'np', pragmaTextVNode: 'ctv', pragmaFragmentVNode: 'cf'}, '<div><Foo {...p}/>text<></></div>')).to.equal('import { newVNode as cv, newFragment as cf, newComponentVNode as ccv, normalizeProps as np, newTextVNode as ctv } from "inferno";\ncv(5, "div", null, [np(ccv(0, Foo, {\n  ...p\n})), ctv("text"), cf(272)]);');
    });

    it('Should call every helper by its pragma name without imports', function () {
      expect(transformWith({imports: false, pragma: 'cv', pragmaCreateComponentVNode: 'ccv', pragmaNormalizeProps: 'np', pragmaTextVNode: 'ctv', pragmaFragmentVNode: 'cf'}, '<div><Foo {...p}/>text<></></div>')).to.equal('cv(5, "div", null, [np(ccv(0, Foo, {\n  ...p\n})), ctv("text"), cf(272)]);');
    });

    it('Should declare default helper names when only a component pragma is set', function () {
      expect(transformWith({imports: false, pragmaCreateComponentVNode: 'ccv'}, '<div><Foo {...p}/>text<></></div>')).to.equal('var newVNode = Inferno.newVNode,\n  newFragment = Inferno.newFragment,\n  newComponentVNode = Inferno.newComponentVNode,\n  normalizeProps = Inferno.normalizeProps,\n  newTextVNode = Inferno.newTextVNode;\nnewVNode(5, "div", null, [normalizeProps(ccv(0, Foo, {\n  ...p\n})), newTextVNode("text"), newFragment(272)]);');
    });
  });

  describe('defineAllArguments option', function () {
    it('Should define all component arguments', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<Foo/>'))).to.equal('newComponentVNode(0, Foo, null, null, null);');
    });

    it('Should accept the string "true"', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: 'true'}, '<Foo key="a"/>'))).to.equal('newComponentVNode(0, Foo, null, "a", null);');
    });

    it('Should define all element arguments', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<div className="c">x</div>'))).to.equal('newVNode(3, "div", "c", "x", null, null, null);');
    });

    it('Should define all arguments of an empty short syntax fragment', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<></>'))).to.equal('newFragment(272, null, null);');
    });

    it('Should define all arguments of a short syntax fragment with dynamic children', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<>{a}</>'))).to.equal('newFragment(256, a, null);');
    });

    it('Should define all arguments of a short syntax fragment with static children', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<><div/></>'))).to.equal('newFragment(260, [newVNode(17, "div", null, null, null, null, null)], null);');
    });

    it('Should define all arguments of an empty long syntax Fragment like short syntax', function () {
      expect(stripInfernoImport(transformWith({imports: true, defineAllArguments: true}, '<Fragment></Fragment>'))).to.equal('newFragment(272, null, null);');
    });
  });

  describe('existing bindings', function () {
    it('Should use a top-level newVNode function instead of importing', function () {
      expect(transformWith({imports: true}, 'function newVNode(){}\nconst a = <div/>;')).to.equal('function newVNode() {}\nconst a = newVNode(17, "div");');
    });

    it('Should use newVNode imported from another module', function () {
      expect(transformWith({imports: true}, 'import {newVNode} from "other-lib";\nconst a = <div/>;')).to.equal('import { newVNode } from "other-lib";\nconst a = newVNode(17, "div");');
    });

    it('Should still import newVNode when it is imported under another name', function () {
      expect(transformWith({imports: true}, 'import {newVNode as cv} from "inferno";\nconst a = <div/>;')).to.equal('import { newVNode } from "inferno";\nimport { newVNode as cv } from "inferno";\nconst a = newVNode(17, "div");');
    });

    it('Should import createVNode next to a namespace import', function () {
      expect(transformWith({imports: true}, 'import * as Inferno from "inferno";\nconst a = <div/>;')).to.equal('import { newVNode } from "inferno";\nimport * as Inferno from "inferno";\nconst a = newVNode(17, "div");');
    });

    it('Should not import helpers that are already imported', function () {
      expect(transformWith({imports: true}, 'import {newVNode, newComponentVNode} from "inferno";\nconst a = <div><Foo/></div>;')).to.equal('import { newVNode, newComponentVNode } from "inferno";\nconst a = newVNode(9, "div", null, newComponentVNode(0, Foo));');
    });

    it('Should ignore bindings named after other JSX runtimes', function () {
      expect(transformWith({imports: true}, 'const _jsx = 1, jsx = 2;\n<div/>;')).to.equal('import { newVNode } from "inferno";\nconst _jsx = 1,\n  jsx = 2;\nnewVNode(17, "div");');
    });

    it('Should import helpers next to an existing inferno import', function () {
      expect(transformWith({imports: true}, 'import {Component} from "inferno";\nexport class A extends Component { render() { return <div/>; } }')).to.equal('import { newVNode } from "inferno";\nimport { Component } from "inferno";\nexport class A extends Component {\n  render() {\n    return newVNode(17, "div");\n  }\n}');
    });

    it('Should not import a helper twice when the code also calls it', function () {
      expect(transformWith({imports: true}, 'import {newVNode} from "inferno";\nexport const a = <div/>;\nexport const b = newVNode(17, "b");')).to.equal('import { newVNode } from "inferno";\nexport const a = newVNode(17, "div");\nexport const b = newVNode(17, "b");');
    });

    it('Should import missing helpers next to an import of other helpers', function () {
      expect(transformWith({imports: true}, 'import {newFragment} from "inferno";\nexport const a = <><div/></>;\ncreateFragment;')).to.equal('import { newVNode } from "inferno";\nimport { newFragment } from "inferno";\nexport const a = newFragment(260, [newVNode(17, "div")]);\ncreateFragment;');
    });

    it('Should import helpers when only types are imported from inferno', function () {
      expect(transformTSX('import type {VNode} from "inferno";\nexport const a: VNode = <div/>;')).to.equal('import { newVNode } from "inferno";\nexport const a = newVNode(17, "div");');
      expect(transformTSX('import {type VNode} from "inferno";\nexport const a: VNode = <div/>;')).to.equal('import { newVNode } from "inferno";\nimport "inferno";\nexport const a = newVNode(17, "div");');
    });

    it('Should not treat a re-export of inferno as an import', function () {
      expect(transformWith({imports: true}, 'export * from "inferno";\nexport const a = <div/>;')).to.equal('import { newVNode } from "inferno";\nexport * from "inferno";\nexport const a = newVNode(17, "div");');
    });

    it('Should import helpers next to a used default import', function () {
      expect(transformWith({imports: true}, 'import Inferno from "inferno";\nInferno.render(<div/>, root);')).to.equal('import { newVNode } from "inferno";\nimport Inferno from "inferno";\nInferno.render(newVNode(17, "div"), root);');
    });

    it('Should import helpers next to a side effect import', function () {
      expect(transformWith({imports: true}, 'import "inferno";\nexport const a = <div/>;')).to.equal('import { newVNode } from "inferno";\nimport "inferno";\nexport const a = newVNode(17, "div");');
    });
  });

  describe('import emission', function () {
    it('Should not import anything without JSX', function () {
      expect(transformWith({imports: true}, 'const a = 1;')).to.equal('const a = 1;');
    });

    it('Should import once for many JSX roots', function () {
      expect(transformWith({imports: true}, 'const a = <div/>;\nconst b = <span/>;')).to.equal('import { newVNode } from "inferno";\nconst a = newVNode(17, "div");\nconst b = newVNode(17, "span");');
    });

    it('Should keep output on the original lines with retainLines', function () {
      expect(transformWith({imports: true}, 'const a = <div>\n  <span/>\n</div>;', {retainLines: true})).to.equal('import { newVNode } from "inferno";const a = newVNode(9, "div", null,\nnewVNode(17, "span")\n);');
    });

    it('Should require helpers in a file parsed as script by sourceType unambiguous', function () {
      expect(transformWith({imports: true}, 'const a = require("x");\nconst b = <div/>;', {sourceType: 'unambiguous'})).to.equal('var _inferno = require("inferno"),\n  newVNode = _inferno.newVNode;\nconst a = require("x");\nconst b = newVNode(17, "div");');
    });

    it('Should import helpers in a file parsed as module by sourceType unambiguous', function () {
      expect(transformWith({imports: true}, 'import x from "x";\nconst b = <div/>;', {sourceType: 'unambiguous'})).to.equal('import { newVNode } from "inferno";\nimport x from "x";\nconst b = newVNode(17, "div");');
    });

    it('Should require every used helper in a script', function () {
      var code = transformWith({imports: true}, 'const a = <div><Foo {...p}/>text<></></div>;', {sourceType: 'script'});

      expect(code).to.equal('var _inferno = require("inferno"),\n  newVNode = _inferno.newVNode,\n  newFragment = _inferno.newFragment,\n  newComponentVNode = _inferno.newComponentVNode,\n  normalizeProps = _inferno.normalizeProps,\n  newTextVNode = _inferno.newTextVNode;\nconst a = newVNode(5, "div", null, [normalizeProps(newComponentVNode(0, Foo, {\n  ...p\n})), newTextVNode("text"), newFragment(272)]);');
      expectValidJS(code, 'script');
    });

    it('Should require helpers after directives in a script', function () {
      expect(transformWith({imports: true}, '"use strict";\nconst a = <div/>;', {sourceType: 'script'})).to.equal('"use strict";\n\nvar _inferno = require("inferno"),\n  newVNode = _inferno.newVNode;\nconst a = newVNode(17, "div");');
    });

    it('Should require helpers from a custom module name in a script', function () {
      expect(transformWith({imports: 'inferno-compat'}, 'const a = <div/>;', {sourceType: 'script'})).to.equal('var _infernoCompat = require("inferno-compat"),\n  newVNode = _infernoCompat.newVNode;\nconst a = newVNode(17, "div");');
    });

    it('Should require helpers under their pragma names in a script', function () {
      expect(transformWith({imports: true, pragma: 'cv'}, 'const a = <div><Foo/></div>;', {sourceType: 'script'})).to.equal('var _inferno = require("inferno"),\n  cv = _inferno.newVNode,\n  newComponentVNode = _inferno.newComponentVNode;\nconst a = cv(9, "div", null, newComponentVNode(0, Foo));');
    });

    it('Should not require helpers that are already declared in a script', function () {
      expect(transformWith({imports: true}, 'function newVNode() {}\nconst a = <div><Foo/></div>;', {sourceType: 'script'})).to.equal('var _inferno = require("inferno"),\n  newComponentVNode = _inferno.newComponentVNode;\nfunction newVNode() {}\nconst a = newVNode(9, "div", null, newComponentVNode(0, Foo));');
    });

    it('Should use a unique name for the required module in a script', function () {
      expect(transformWith({imports: true}, 'var _inferno = 1;\nconst a = <div/>;', {sourceType: 'script'})).to.equal('var _inferno2 = require("inferno"),\n  newVNode = _inferno2.newVNode;\nvar _inferno = 1;\nconst a = newVNode(17, "div");');
    });

    it('Should import helpers after the "use client" directive', function () {
      expect(transformWith({imports: true}, '"use client";\nexport const a = <div/>;')).to.equal('"use client";\n\nimport { newVNode } from "inferno";\nexport const a = newVNode(17, "div");');
    });

    it('Should emit a valid ES module', function () {
      var code = transformWith({imports: true}, 'import {a} from "b";\nexport const el = <div><Foo {...p}/>text<></>{a}</div>;');

      expect(code).to.equal('import { newVNode, newFragment, newComponentVNode, normalizeProps, newTextVNode } from "inferno";\nimport { a } from "b";\nexport const el = newVNode(1, "div", null, [normalizeProps(newComponentVNode(0, Foo, {\n  ...p\n})), newTextVNode("text"), newFragment(272), a]);');
      expectValidJS(code);
    });

    it('Should emit a valid CommonJS module', function () {
      var code = transformWith({imports: true}, 'import {a} from "b";\nexport const el = <div><Foo {...p}/>text<></>{a}</div>;', es5CommonJS);

      expect(code).to.not.contain('import ');
      expect(code).to.contain('require("inferno")');
      expectValidJS(code, 'script');
    });
  });

  // JSX pragma comments are not supported; they stay in the output unchanged
  describe('pragma comments', function () {
    it('Should ignore @jsx and @jsxFrag comments', function () {
      expect(transformWith({imports: true}, '/** @jsx h */\n/** @jsxFrag F */\n<><div/></>')).to.equal('import { newVNode, newFragment } from "inferno";\n/** @jsx h */\n/** @jsxFrag F */\nnewFragment(260, [newVNode(17, "div")]);');
    });

    it('Should ignore @jsxRuntime and @jsxImportSource comments', function () {
      expect(transformWith({imports: true}, '/** @jsxRuntime classic */\n/** @jsxImportSource preact */\n<div/>')).to.equal('import { newVNode } from "inferno";\n/** @jsxRuntime classic */\n/** @jsxImportSource preact */\nnewVNode(17, "div");');
    });
  });

  describe('current behaviour (questionable)', function () {
    // The generated call resolves to the local constant
    it('Should not detect a local binding that shadows newVNode', function () {
      expect(transformWith({imports: true}, 'function f(){ const newVNode = 1; return <div/>; }')).to.equal('import { newVNode } from "inferno";\nfunction f() {\n  const newVNode = 1;\n  return newVNode(17, "div");\n}');
    });

    // Babel annotates generated calls with /*#__PURE__*/ for tree-shaking
    it('Should not add pure annotations to generated calls', function () {
      var code = transformWith({imports: true}, '<div><Foo/></div>');

      expect(code).to.not.contain('__PURE__');
    });

    it('Should ignore unknown options', function () {
      expect(transformWith({imports: true, pragmaa: 'x'}, '<div/>')).to.equal('import { newVNode } from "inferno";\nnewVNode(17, "div");');
    });
  });
});
