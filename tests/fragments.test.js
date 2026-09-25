var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformWith = helpers.transformWith;
var pluginTransform = helpers.pluginTransform;

describe('Fragments', function () {
  describe('keyed fragments', function () {
    it('Should create a keyed empty self-closing Fragment', function () {
      expect(transform('<Fragment key="k"/>')).to.equal('createFragment(null, 1, "k");');
    });

    it('Should create a keyed empty Fragment', function () {
      expect(transform('<Fragment key="k"></Fragment>')).to.equal('createFragment(null, 1, "k");');
    });

    it('Should create a keyed Fragment with text', function () {
      expect(transform('<Fragment key="k">text</Fragment>')).to.equal('createFragment([createTextVNode("text")], 4, "k");');
    });

    it('Should mark keyed fragments as keyed children', function () {
      expect(transform('<div><Fragment key="a"><b/></Fragment><Fragment key="c"><d/></Fragment></div>')).to.equal('createVNode(1, "div", null, [createFragment([createVNode(1, "b")], 4, "a"), createFragment([createVNode(1, "d")], 4, "c")], 8);');
    });

    it('Should create an empty Fragment with $HasKeyedChildren', function () {
      expect(transform('<Fragment $HasKeyedChildren/>')).to.equal('createFragment();');
    });
  });

  describe('$HasTextChildren', function () {
    it('Should compile a dynamic child into a text vNode', function () {
      expect(pluginTransform('<Fragment $HasTextChildren>{x}</Fragment>')).to.equal('import { createFragment, createTextVNode } from "inferno";\ncreateFragment([createTextVNode(x)], 4);');
    });

    it('Should compile a dynamic child into a text vNode in a keyed Fragment', function () {
      expect(transform('<Fragment $HasTextChildren key="k">{x}</Fragment>')).to.equal('createFragment([createTextVNode(x)], 4, "k");');
    });

    it('Should compile static text into a text vNode', function () {
      expect(transform('<Fragment $HasTextChildren>text</Fragment>')).to.equal('createFragment([createTextVNode("text")], 4);');
    });

    it('Should put a string expression child in an array', function () {
      expect(transform('<Fragment $HasTextChildren>{"text"}</Fragment>')).to.equal('createFragment([createTextVNode("text")], 4);');
    });

    it('Should compile a children prop expression into a text vNode', function () {
      expect(transform('<Fragment $HasTextChildren children={x} />')).to.equal('createFragment([createTextVNode(x)], 4);');
    });

    it('Should put a children prop string in an array', function () {
      expect(transform('<Fragment $HasTextChildren children="text" />')).to.equal('createFragment([createTextVNode("text")], 4);');
    });

    it('Should evaluate an overridden children prop once', function () {
      expect(transform('<Fragment $HasTextChildren children={f()}>{x}</Fragment>')).to.equal('createFragment([(f(), createTextVNode(x))], 4);');
    });

    it('Should keep an element child as a vNode', function () {
      expect(pluginTransform('<Fragment $HasTextChildren><a/></Fragment>')).to.equal('import { createVNode, createFragment } from "inferno";\ncreateFragment([createVNode(1, "a")], 4);');
    });

    it('Should keep an element expression child as a vNode', function () {
      expect(transform('<Fragment $HasTextChildren>{<a/>}</Fragment>')).to.equal('createFragment([createVNode(1, "a")], 4);');
    });

    it('Should keep an element child next to an empty expression as a vNode', function () {
      expect(transform('<Fragment $HasTextChildren>{/* c */}<a/></Fragment>')).to.equal('createFragment([createVNode(1, "a")], 4);');
    });

    it('Should keep an element children prop as a vNode', function () {
      expect(transform('<Fragment $HasTextChildren children=<a/> />')).to.equal('createFragment([createVNode(1, "a")], 4);');
    });

    it('Should not import createTextVNode without children', function () {
      expect(pluginTransform('<Fragment $HasTextChildren />')).to.equal('import { createFragment } from "inferno";\ncreateFragment();');
    });

    it('Should not import createTextVNode for a null children prop', function () {
      expect(pluginTransform('<Fragment $HasTextChildren children={null} />')).to.equal('import { createFragment } from "inferno";\ncreateFragment();');
    });

    it('Should not declare createTextVNode without children when imports are disabled', function () {
      expect(transformWith({imports: false}, '<Fragment $HasTextChildren />')).to.equal('var createFragment = Inferno.createFragment;\ncreateFragment();');
    });

    it('Should use pragmaTextVNode for a dynamic child', function () {
      expect(transformWith({imports: true, pragmaTextVNode: 'text'}, '<Fragment $HasTextChildren>{x}</Fragment>')).to.equal('import { createFragment, createTextVNode as text } from "inferno";\ncreateFragment([text(x)], 4);');
    });
  });

  describe('$HasVNodeChildren', function () {
    it('Should pass a dynamic child as a single vNode', function () {
      expect(transform('<Fragment $HasVNodeChildren>{x}</Fragment>')).to.equal('createFragment(x, 2);');
    });

    it('Should pass a dynamic child as a single vNode in a keyed Fragment', function () {
      expect(transform('<Fragment $HasVNodeChildren key="k">{x}</Fragment>')).to.equal('createFragment(x, 2, "k");');
    });

    it('Should pass an element expression child as a single vNode', function () {
      expect(transform('<Fragment $HasVNodeChildren>{<a/>}</Fragment>')).to.equal('createFragment(createVNode(1, "a"), 2);');
    });

    it('Should pass an element child next to an empty expression as a single vNode', function () {
      expect(transform('<Fragment $HasVNodeChildren>{/* c */}<a/></Fragment>')).to.equal('createFragment(createVNode(1, "a"), 2);');
    });

    it('Should evaluate an overridden children prop before a dynamic child', function () {
      expect(transform('<Fragment $HasVNodeChildren children={f()}>{x}</Fragment>')).to.equal('createFragment((f(), x), 2);');
    });

    it('Should put a static element child in an array', function () {
      expect(transform('<Fragment $HasVNodeChildren><a/></Fragment>')).to.equal('createFragment([createVNode(1, "a")], 4);');
    });

    it('Should compile static text into a text vNode', function () {
      expect(transform('<Fragment $HasVNodeChildren>text</Fragment>')).to.equal('createFragment([createTextVNode("text")], 4);');
    });
  });

  describe('string children prop', function () {
    it('Should compile a children prop string into a text vNode', function () {
      expect(pluginTransform('<Fragment children="text" />')).to.equal('import { createFragment, createTextVNode } from "inferno";\ncreateFragment([createTextVNode("text")], 4);');
    });

    it('Should compile a children prop string into a text vNode in a keyed Fragment', function () {
      expect(transform('<Fragment children="text" key="k" />')).to.equal('createFragment([createTextVNode("text")], 4, "k");');
    });

    it('Should compile a children prop string into a text vNode in a React.Fragment', function () {
      expect(transform('<React.Fragment children="text" />')).to.equal('createFragment([createTextVNode("text")], 4);');
    });

    it('Should keep single-line whitespace in a children prop string', function () {
      expect(transform('<Fragment children="  " />')).to.equal('createFragment([createTextVNode("  ")], 4);');
    });

    it('Should create an empty Fragment for an empty children prop string', function () {
      expect(pluginTransform('<Fragment children="" />')).to.equal('import { createFragment } from "inferno";\ncreateFragment();');
    });

    it('Should put a children prop string in an array with $HasNonKeyedChildren', function () {
      expect(transform('<Fragment $HasNonKeyedChildren children="text" />')).to.equal('createFragment([createTextVNode("text")], 4);');
    });

    it('Should put a children prop string in an array with $HasKeyedChildren', function () {
      expect(transform('<Fragment $HasKeyedChildren children="text" />')).to.equal('createFragment([createTextVNode("text")], 8);');
    });

    it('Should compile a children prop string into a text vNode with $HasVNodeChildren', function () {
      expect(transform('<Fragment $HasVNodeChildren children="text" />')).to.equal('createFragment([createTextVNode("text")], 4);');
    });
  });

  describe('fragment placement', function () {
    it('Should compile an empty React.Fragment inside an element', function () {
      expect(transform('<div><React.Fragment /></div>')).to.equal('createVNode(1, "div", null, createFragment(), 2);');
    });

    it('Should compile a fragment as component children', function () {
      expect(transform('<Foo><>{a}</></Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: createFragment(a, 0)\n});');
    });

    it('Should compile a fragment inside an element next to text', function () {
      expect(transform('<div>text<>{a}</></div>')).to.equal('createVNode(1, "div", null, [createTextVNode("text"), createFragment(a, 0)], 4);');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should drop a spread on Fragment', function () {
      expect(transform('<Fragment {...p}>x</Fragment>')).to.equal('createFragment([createTextVNode("x")], 4);');
    });

    it('Should drop ref on Fragment', function () {
      expect(transform('<Fragment ref={r}>x</Fragment>')).to.equal('createFragment([createTextVNode("x")], 4);');
    });

    it('Should drop other props on React.Fragment', function () {
      expect(transform('<React.Fragment a={1}>x</React.Fragment>')).to.equal('createFragment([createTextVNode("x")], 4);');
    });

    it('Should wrap a dynamic child in an array when $ChildFlag is an expression', function () {
      expect(transform('<Fragment $ChildFlag={x}>{a}</Fragment>')).to.equal('createFragment([a], x);');
    });

    it('Should leave several dynamic children declared as text unwrapped and not import createTextVNode', function () {
      expect(pluginTransform('<Fragment $HasTextChildren>{x}{y}</Fragment>')).to.equal('import { createFragment } from "inferno";\ncreateFragment([x, y], 4);');
    });
  });
});
