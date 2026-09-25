var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;

describe('Special flags', function () {
  describe('flag precedence', function () {
    it('Should use text children when $HasVNodeChildren is set on text', function () {
      expect(transform('<div $HasVNodeChildren>text</div>')).to.equal('createVNode(1, "div", null, "text", 16);');
    });

    it('Should infer non keyed children when $HasVNodeChildren is set on several children', function () {
      expect(transform('<div $HasVNodeChildren><a/><b/></div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "a"), createVNode(1, "b")], 4);');
    });

    it('Should use $HasKeyedChildren for static children', function () {
      expect(transform('<div $HasKeyedChildren><a/><b/></div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "a"), createVNode(1, "b")], 8);');
    });

    it('Should prefer $HasKeyedChildren over $HasNonKeyedChildren', function () {
      expect(transform('<div $HasKeyedChildren $HasNonKeyedChildren>{a}</div>')).to.equal('createVNode(1, "div", null, a, 8);');
    });

    it('Should prefer $ChildFlag over other child flags', function () {
      expect(transform('<div $ChildFlag={1} $HasKeyedChildren>{a}</div>')).to.equal('createVNode(1, "div", null, a, 1);');
    });

    it('Should prefer $Flags over $ReCreate and contentEditable', function () {
      expect(transform('<div $ReCreate contentEditable $Flags={9}/>')).to.equal('createVNode(9, "div", null, null, 1, {\n  "contentEditable": true\n});');
    });
  });

  describe('$ReCreate', function () {
    it('Should add the ReCreate flag to components', function () {
      expect(transform('<Foo $ReCreate/>')).to.equal('createComponentVNode(2050, Foo);');
    });

    it('Should add the ReCreate flag to input elements', function () {
      expect(transform('<input $ReCreate/>')).to.equal('createVNode(2112, "input");');
    });

    it('Should add the ReCreate flag to svg elements', function () {
      expect(transform('<svg $ReCreate/>')).to.equal('createVNode(2080, "svg");');
    });

    it('Should combine ReCreate and ContentEditable flags', function () {
      expect(transform('<div $ReCreate contentEditable/>')).to.equal('createVNode(6145, "div", null, null, 1, {\n  "contentEditable": true\n});');
    });
  });

  describe('other combinations', function () {
    it('Should set text children flag without children', function () {
      expect(transform('<div $HasTextChildren />')).to.equal('createVNode(1, "div", null, null, 16);');
    });

    it('Should ignore child flags on components', function () {
      expect(transform('<Foo $HasKeyedChildren>{a}</Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: a\n});');
    });

    it('Should keep $Flags with a spread', function () {
      expect(transform('<div $Flags={1} {...p}/>')).to.equal('normalizeProps(createVNode(1, "div", null, null, 1, {\n  ...p\n}));');
    });

    it('Should keep $HasVNodeChildren with a spread', function () {
      expect(transform('<div {...p} $HasVNodeChildren>{a}</div>')).to.equal('normalizeProps(createVNode(1, "div", null, a, 2, {\n  ...p\n}));');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should add the ContentEditable flag to components', function () {
      expect(transform('<Foo contentEditable/>')).to.equal('createComponentVNode(4098, Foo, {\n  "contentEditable": true\n});');
    });

    it('Should let inferred non keyed children override $HasTextChildren', function () {
      expect(transform('<div $HasTextChildren><a/><b/></div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "a"), createVNode(1, "b")], 4);');
    });

    it('Should pass a string $ChildFlag through as a string', function () {
      expect(transform('<div $ChildFlag="1">{a}</div>')).to.equal('createVNode(1, "div", null, a, "1");');
    });
  });
});
