var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;

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
  });
});
