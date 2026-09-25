var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('TSX with @babel/preset-typescript', function () {
  describe('type syntax', function () {
    it('Should drop type arguments of components', function () {
      expect(stripInfernoImport(transformTSX('<Foo<string> bar={x as any} baz={y!} />'))).to.equal('createComponentVNode(2, Foo, {\n  "bar": x,\n  "baz": y\n});');
    });

    it('Should drop type arguments of components with children', function () {
      expect(stripInfernoImport(transformTSX('<C<number>></C>;\n<C<number>/>;'))).to.equal('createComponentVNode(2, C);\ncreateComponentVNode(2, C);');
    });

    it('Should drop function type arguments', function () {
      expect(stripInfernoImport(transformTSX('<Component<<T>(v: T) => void> />'))).to.equal('createComponentVNode(2, Component);');
    });

    it('Should strip as expressions in ref and children', function () {
      expect(stripInfernoImport(transformTSX('<div ref={r as any}>{(v as number)}</div>'))).to.equal('createVNode(1, "div", null, v, 0, null, null, r);');
    });

    it('Should strip as and non-null expressions in children', function () {
      expect(stripInfernoImport(transformTSX('<div>{(v as number)}{w!}</div>'))).to.equal('createVNode(1, "div", null, [v, w], 0);');
    });

    it('Should strip as expressions in spreads', function () {
      expect(stripInfernoImport(transformTSX('<Foo {...(p as Props)} />'))).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n}));');
    });

    it('Should strip parameter types of event handlers', function () {
      expect(stripInfernoImport(transformTSX('<div onClick={(e: MouseEvent) => f(e)} />'))).to.equal('createVNode(1, "div", null, null, 1, {\n  "onClick": e => f(e)\n});');
    });

    it('Should strip satisfies in keys', function () {
      expect(stripInfernoImport(transformTSX('<div key={k satisfies string} />'))).to.equal('createVNode(1, "div", null, null, 1, null, k);');
    });

    it('Should compile JSX in a generic arrow function', function () {
      expect(stripInfernoImport(transformTSX('export const f = <T,>(x: T) => <div>{x as any}</div>;'))).to.equal('export const f = x => createVNode(1, "div", null, x, 0);');
    });

    it('Should compile JSX next to an enum', function () {
      expect(stripInfernoImport(transformTSX('enum E { A }\nexport const a = <div data-e={E.A}/>;'))).to.equal('var E = /*#__PURE__*/function (E) {\n  E[E["A"] = 0] = "A";\n  return E;\n}(E || {});\nexport const a = createVNode(1, "div", null, null, 1, {\n  "data-e": E.A\n});');
    });

    it('Should compile JSX inside a namespace', function () {
      expect(stripInfernoImport(transformTSX('namespace N { export const el = <div/>; }'))).to.equal('let N;\n(function (_N) {\n  const el = _N.el = createVNode(1, "div");\n})(N || (N = {}));');
    });

    it('Should compile JSX after a generic class', function () {
      expect(stripInfernoImport(transformTSX('class C extends D<T> {}\n<C/>;'))).to.equal('class C extends D {}\ncreateComponentVNode(2, C);');
    });
  });

  describe('import elision', function () {
    it('Should keep an import that is only used as a JSX tag', function () {
      expect(transformTSX('import Foo from "./Foo";\nexport const a = <Foo/>;')).to.equal('import { createComponentVNode } from "inferno";\nimport Foo from "./Foo";\nexport const a = createComponentVNode(2, Foo);');
    });

    it('Should remove type imports and keep component imports', function () {
      expect(transformTSX('import { Foo } from "./Foo";\nimport type { P } from "./P";\nexport const a = <Foo<P> x={1 as number} y={z!} w={q satisfies P}/>;')).to.equal('import { createComponentVNode } from "inferno";\nimport { Foo } from "./Foo";\nexport const a = createComponentVNode(2, Foo, {\n  "x": 1,\n  "y": z,\n  "w": q\n});');
    });

    it('Should keep an existing createVNode import', function () {
      expect(transformTSX('import { createVNode } from "inferno";\nexport const a = <div/>;')).to.equal('import { createVNode } from "inferno";\nexport const a = createVNode(1, "div");');
    });

    it('Should keep an existing createVNode import with onlyRemoveTypeImports', function () {
      expect(transformTSX('import { createVNode } from "inferno";\nexport const a = <div/>;', {imports: true}, {onlyRemoveTypeImports: true})).to.equal('import { createVNode } from "inferno";\nexport const a = createVNode(1, "div");');
    });

    it('Should keep an Inferno namespace import with imports false', function () {
      expect(transformTSX('import * as Inferno from "inferno";\nexport const a = <div/>;', {imports: false})).to.equal('import * as Inferno from "inferno";\nvar createVNode = Inferno.createVNode;\nexport const a = createVNode(1, "div");');
    });

    it('Should keep an Inferno default import with imports false', function () {
      expect(transformTSX('import Inferno from "inferno";\nexport const a = <div/>;', {imports: false})).to.equal('import Inferno from "inferno";\nvar createVNode = Inferno.createVNode;\nexport const a = createVNode(1, "div");');
    });

    it('Should keep a React namespace import', function () {
      expect(transformTSX('import * as React from "react";\nexport const a = <div/>;')).to.equal('import { createVNode } from "inferno";\nimport * as React from "react";\nexport const a = createVNode(1, "div");');
    });

    it('Should keep the jsxPragma import', function () {
      expect(transformTSX('import { h } from "preact";\nexport const a = <div/>;', {imports: true}, {jsxPragma: 'h'})).to.equal('import { createVNode } from "inferno";\nimport { h } from "preact";\nexport const a = createVNode(1, "div");');
    });
  });
});
