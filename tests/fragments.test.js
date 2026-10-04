var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformWith = helpers.transformWith;
var pluginTransform = helpers.pluginTransform;
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('Fragments', function () {
  describe('keyed fragments', function () {
    it('Should create a keyed empty self-closing Fragment', function () {
      expect(transform('<Fragment key="k"/>')).to.equal('newFragment(272, null, "k");');
    });

    it('Should create a keyed empty Fragment', function () {
      expect(transform('<Fragment key="k"></Fragment>')).to.equal('newFragment(272, null, "k");');
    });

    it('Should create a keyed Fragment with text', function () {
      expect(transform('<Fragment key="k">text</Fragment>')).to.equal('newFragment(260, [newTextVNode("text")], "k");');
    });

    it('Should mark keyed fragments as keyed children', function () {
      expect(transform('<div><Fragment key="a"><b/></Fragment><Fragment key="c"><d/></Fragment></div>')).to.equal('newVNode(33, "div", null, [newFragment(260, [newVNode(17, "b")], "a"), newFragment(260, [newVNode(17, "d")], "c")]);');
    });

    it('Should throw for an empty Fragment with $HasKeyedChildren', function () {
      expect(function () {
        transform('<Fragment $HasKeyedChildren/>');
      }).to.throw('$HasKeyedChildren needs an array of elements or components that all have a key, but there are no children.');
    });

    it('Should create a keyed empty React.Fragment', function () {
      expect(stripInfernoImport(transformTSX('<React.Fragment key={id!} />'))).to.equal('newFragment(272, null, id);');
    });

    it('Should create a keyed Fragment with dynamic children', function () {
      expect(transform('<Fragment key="k">{a}</Fragment>')).to.equal('newFragment(256, a, "k");');
    });

    it('Should create a keyed React.Fragment with non keyed children', function () {
      expect(transform('<React.Fragment key="k"><a/><b/></React.Fragment>')).to.equal('newFragment(260, [newVNode(17, "a"), newVNode(17, "b")], "k");');
    });

    it('Should strip a type assertion from a Fragment key', function () {
      expect(stripInfernoImport(transformTSX('<Fragment key={k as string}><a/></Fragment>'))).to.equal('newFragment(260, [newVNode(17, "a")], k);');
    });
  });

  describe('$HasTextChildren', function () {
    it('Should compile a dynamic child into a text vNode', function () {
      expect(pluginTransform('<Fragment $HasTextChildren>{x}</Fragment>')).to.equal('import { newFragment, newTextVNode } from "inferno";\nnewFragment(260, [newTextVNode(x)]);');
    });

    it('Should compile a dynamic child into a text vNode in a keyed Fragment', function () {
      expect(transform('<Fragment $HasTextChildren key="k">{x}</Fragment>')).to.equal('newFragment(260, [newTextVNode(x)], "k");');
    });

    it('Should compile static text into a text vNode', function () {
      expect(transform('<Fragment $HasTextChildren>text</Fragment>')).to.equal('newFragment(260, [newTextVNode("text")]);');
    });

    it('Should put a string expression child in an array', function () {
      expect(transform('<Fragment $HasTextChildren>{"text"}</Fragment>')).to.equal('newFragment(260, [newTextVNode("text")]);');
    });

    it('Should compile a children prop expression into a text vNode', function () {
      expect(transform('<Fragment $HasTextChildren children={x} />')).to.equal('newFragment(260, [newTextVNode(x)]);');
    });

    it('Should put a children prop string in an array', function () {
      expect(transform('<Fragment $HasTextChildren children="text" />')).to.equal('newFragment(260, [newTextVNode("text")]);');
    });

    it('Should evaluate an overridden children prop once', function () {
      expect(transform('<Fragment $HasTextChildren children={f()}>{x}</Fragment>')).to.equal('newFragment(260, [(f(), newTextVNode(x))]);');
    });

    it('Should throw for $HasTextChildren on an element child', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren><a/></Fragment>');
      }).to.throw('$HasTextChildren needs one text child, but the child is an element.');
    });

    it('Should throw for $HasTextChildren on an element expression child', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren>{<a/>}</Fragment>');
      }).to.throw('$HasTextChildren needs one text child, but the child is an element.');
    });

    it('Should throw for $HasTextChildren on an element child next to an empty expression', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren>{/* c */}<a/></Fragment>');
      }).to.throw('$HasTextChildren needs one text child, but the child is an element.');
    });

    it('Should throw for $HasTextChildren on an element children prop', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren children=<a/> />');
      }).to.throw('$HasTextChildren needs one text child, but the child is an element.');
    });

    it('Should throw for $HasTextChildren without children', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren />');
      }).to.throw('$HasTextChildren needs one text child, but there are no children.');
    });

    it('Should throw for $HasTextChildren on a null children prop', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren children={null} />');
      }).to.throw('$HasTextChildren needs one text child, but the child is null, which renders nothing.');
    });

    it('Should throw for $HasTextChildren without children when imports are disabled', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren />');
      }).to.throw('$HasTextChildren needs one text child, but there are no children.');
    });

    it('Should use pragmaTextVNode for a dynamic child', function () {
      expect(transformWith({imports: true, pragmaTextVNode: 'text'}, '<Fragment $HasTextChildren>{x}</Fragment>')).to.equal('import { newFragment, newTextVNode as text } from "inferno";\nnewFragment(260, [text(x)]);');
    });
  });

  describe('$HasVNodeChildren', function () {
    it('Should pass a dynamic child as a single vNode', function () {
      expect(transform('<Fragment $HasVNodeChildren>{x}</Fragment>')).to.equal('newFragment(264, x);');
    });

    it('Should pass a dynamic child as a single vNode in a keyed Fragment', function () {
      expect(transform('<Fragment $HasVNodeChildren key="k">{x}</Fragment>')).to.equal('newFragment(264, x, "k");');
    });

    it('Should pass an element expression child as a single vNode', function () {
      expect(transform('<Fragment $HasVNodeChildren>{<a/>}</Fragment>')).to.equal('newFragment(264, newVNode(17, "a"));');
    });

    it('Should pass an element child next to an empty expression as a single vNode', function () {
      expect(transform('<Fragment $HasVNodeChildren>{/* c */}<a/></Fragment>')).to.equal('newFragment(264, newVNode(17, "a"));');
    });

    it('Should evaluate an overridden children prop before a dynamic child', function () {
      expect(transform('<Fragment $HasVNodeChildren children={f()}>{x}</Fragment>')).to.equal('newFragment(264, (f(), x));');
    });

    it('Should put a static element child in an array', function () {
      expect(transform('<Fragment $HasVNodeChildren><a/></Fragment>')).to.equal('newFragment(260, [newVNode(17, "a")]);');
    });

    it('Should throw for $HasVNodeChildren on static text', function () {
      expect(function () {
        transform('<Fragment $HasVNodeChildren>text</Fragment>');
      }).to.throw('$HasVNodeChildren needs one element or component child, but the child is text.');
    });
  });

  describe('string children prop', function () {
    it('Should compile a children prop string into a text vNode', function () {
      expect(pluginTransform('<Fragment children="text" />')).to.equal('import { newFragment, newTextVNode } from "inferno";\nnewFragment(260, [newTextVNode("text")]);');
    });

    it('Should compile a children prop string into a text vNode in a keyed Fragment', function () {
      expect(transform('<Fragment children="text" key="k" />')).to.equal('newFragment(260, [newTextVNode("text")], "k");');
    });

    it('Should compile a children prop string into a text vNode in a React.Fragment', function () {
      expect(transform('<React.Fragment children="text" />')).to.equal('newFragment(260, [newTextVNode("text")]);');
    });

    it('Should keep single-line whitespace in a children prop string', function () {
      expect(transform('<Fragment children="  " />')).to.equal('newFragment(260, [newTextVNode("  ")]);');
    });

    it('Should create an empty Fragment for an empty children prop string', function () {
      expect(pluginTransform('<Fragment children="" />')).to.equal('import { newFragment } from "inferno";\nnewFragment(272);');
    });

    it('Should throw for a children prop string with $HasNonKeyedChildren', function () {
      expect(function () {
        transform('<Fragment $HasNonKeyedChildren children="text" />');
      }).to.throw('$HasNonKeyedChildren needs an array of elements or components, but the child is text.');
    });

    it('Should throw for a children prop string with $HasKeyedChildren', function () {
      expect(function () {
        transform('<Fragment $HasKeyedChildren children="text" />');
      }).to.throw('$HasKeyedChildren needs an array of elements or components that all have a key, but the child is text.');
    });

    it('Should throw for a children prop string with $HasVNodeChildren', function () {
      expect(function () {
        transform('<Fragment $HasVNodeChildren children="text" />');
      }).to.throw('$HasVNodeChildren needs one element or component child, but the child is text.');
    });
  });

  describe('fragment placement', function () {
    it('Should compile an empty React.Fragment inside an element', function () {
      expect(transform('<div><React.Fragment /></div>')).to.equal('newVNode(9, "div", null, newFragment(272));');
    });

    it('Should compile a fragment as component children', function () {
      expect(transform('<Foo><>{a}</></Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: newFragment(256, a)\n});');
    });

    it('Should compile a fragment inside an element next to text', function () {
      expect(transform('<div>text<>{a}</></div>')).to.equal('newVNode(5, "div", null, [newTextVNode("text"), newFragment(256, a)]);');
    });

    it('Should compile a fragment as children of a generic component', function () {
      expect(stripInfernoImport(transformTSX('<Foo<string>><>{a}</></Foo>'))).to.equal('newComponentVNode(0, Foo, {\n  children: newFragment(256, a)\n});');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should drop a spread on Fragment', function () {
      expect(transform('<Fragment {...p}>x</Fragment>')).to.equal('newFragment(260, [newTextVNode("x")]);');
    });

    it('Should drop ref on Fragment', function () {
      expect(transform('<Fragment ref={r}>x</Fragment>')).to.equal('newFragment(260, [newTextVNode("x")]);');
    });

    it('Should drop other props on React.Fragment', function () {
      expect(transform('<React.Fragment a={1}>x</React.Fragment>')).to.equal('newFragment(260, [newTextVNode("x")]);');
    });

    // The $ChildFlag declares the shape of the child as it is written, so the child is not put in an array
    it('Should pass a dynamic child as written when $ChildFlag is an expression', function () {
      expect(transform('<Fragment $ChildFlag={x}>{a}</Fragment>')).to.equal('createFragment(a, x);');
      expect(transform('<Fragment $ChildFlag={x} key="k">{a}</Fragment>')).to.equal('createFragment(a, x, "k");');
      expect(transform('<Fragment $ChildFlag={x} children={a} />')).to.equal('createFragment(a, x);');
    });

    it('Should pass a dynamic child as written when $ChildFlag is a number', function () {
      expect(transform('<Fragment $ChildFlag={16}>{a}</Fragment>')).to.equal('newFragment(258, a);');
      expect(transform('<Fragment $ChildFlag={1}>{a}</Fragment>')).to.equal('newFragment(272, a);');
    });

    it('Should compile a Fragment with only a null child like an empty one', function () {
      expect(transform('<Fragment>{null}</Fragment>')).to.equal('newFragment(272);');
      expect(transform('<Fragment key={null}>{a}</Fragment>')).to.equal('newFragment(256, a);');
    });

    it('Should still put a static child in an array when $ChildFlag is an expression', function () {
      expect(transform('<Fragment $ChildFlag={x}><a/></Fragment>')).to.equal('createFragment([newVNode(17, "a")], x);');
      expect(transform('<Fragment $ChildFlag={x}>text</Fragment>')).to.equal('createFragment([newTextVNode("text")], x);');
    });

    it('Should throw for several dynamic children declared as text', function () {
      expect(function () {
        transform('<Fragment $HasTextChildren>{x}{y}</Fragment>');
      }).to.throw('$HasTextChildren needs one text child, but there are 2 children.');
    });
  });
});
