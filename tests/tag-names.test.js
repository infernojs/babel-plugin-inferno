var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformWith = helpers.transformWith;
var es5 = helpers.es5;

describe('Tag names', function () {
  describe('member expressions', function () {
    it('Should compile this.foo as a component', function () {
      expect(transform('<this.foo />')).to.equal('createComponentVNode(2, this.foo);');
    });

    it('Should compile a nested this member expression with children', function () {
      expect(transform('<this.foo.bar>x</this.foo.bar>')).to.equal('createComponentVNode(2, this.foo.bar, {\n  children: "x"\n});');
    });

    it('Should compile a deep member expression', function () {
      expect(transform('<a.b.c.d />')).to.equal('createComponentVNode(2, a.b.c.d);');
    });

    it('Should compile a lowercase member expression as a component', function () {
      expect(transform('<foo.bar />')).to.equal('createComponentVNode(2, foo.bar);');
    });

    it('Should compile a lowercase context provider as a component', function () {
      expect(transform('<ctx.Provider value={v}>{a}</ctx.Provider>')).to.equal('createComponentVNode(2, ctx.Provider, {\n  "value": v,\n  children: a\n});');
    });

    it('Should compile a member expression ending in this', function () {
      expect(transform('<a.this />')).to.equal('createComponentVNode(2, a.this);');
    });
  });

  describe('identifier tags', function () {
    it('Should compile an underscore-prefixed tag as a component', function () {
      expect(transform('<_foo />')).to.equal('createComponentVNode(2, _foo);');
    });

    it('Should compile a dollar-prefixed tag as a component', function () {
      expect(transform('<$foo />')).to.equal('createComponentVNode(2, $foo);');
    });

    it('Should compile an underscore-prefixed uppercase tag as a component', function () {
      expect(transform('<_Foo />')).to.equal('createComponentVNode(2, _Foo);');
    });

    it('Should compile __proto__ as a component', function () {
      expect(transform('<__proto__ />')).to.equal('createComponentVNode(2, __proto__);');
    });

    it('Should compile an uppercase non-ASCII tag as a component', function () {
      expect(transform('<Ünicode />')).to.equal('createComponentVNode(2, Ünicode);');
    });

    it('Should compile an all-caps tag as a component', function () {
      expect(transform('<SVG />')).to.equal('createComponentVNode(2, SVG);');
    });

    it('Should compile a capitalised tag as a component', function () {
      expect(transform('<Svg />')).to.equal('createComponentVNode(2, Svg);');
    });

    it('Should not treat a lowercase fragment tag as a Fragment', function () {
      expect(transform('<fragment>a</fragment>')).to.equal('createVNode(1, "fragment", null, "a", 16);');
    });

    it('Should not treat a Fragment-prefixed component as a Fragment', function () {
      expect(transform('<FragmentX>a</FragmentX>')).to.equal('createComponentVNode(2, FragmentX, {\n  children: "a"\n});');
    });

    it('Should compile a variable holding a tag name as a component', function () {
      expect(transform('const TagName = "div";\n<TagName />;')).to.equal('const TagName = "div";\ncreateComponentVNode(2, TagName);');
    });
  });

  describe('custom elements', function () {
    it('Should compile a hyphenated tag as an element', function () {
      expect(transform('<my-element foo="bar" />')).to.equal('createVNode(1, "my-element", null, null, 1, {\n  "foo": "bar"\n});');
    });

    it('Should apply className and htmlFor handling to custom elements', function () {
      expect(transform('<my-element className="x" htmlFor="y" />')).to.equal('createVNode(1, "my-element", "x", null, 1, {\n  "for": "y"\n});');
    });

    it('Should compile x-component as an element', function () {
      expect(transform('<x-component />')).to.equal('createVNode(1, "x-component");');
    });

    it('Should compile a custom element with a boolean attribute', function () {
      expect(transform('<o-checkbox checked />')).to.equal('createVNode(1, "o-checkbox", null, null, 1, {\n  "checked": true\n});');
    });
  });

  describe('element flags', function () {
    it('Should flag select elements', function () {
      expect(transform('<select value={v}><option>1</option></select>')).to.equal('createVNode(256, "select", null, createVNode(1, "option", null, "1", 16), 2, {\n  "value": v\n});');
    });

    it('Should flag textarea elements without children', function () {
      expect(transform('<textarea value={v} />')).to.equal('createVNode(128, "textarea", null, null, 1, {\n  "value": v\n});');
    });

    it('Should flag input elements', function () {
      expect(transform('<input disabled />')).to.equal('createVNode(64, "input", null, null, 1, {\n  "disabled": true\n});');
    });

    it('Should flag svg children like foreignObject and keep html inside', function () {
      expect(transform('<svg><foreignObject><div/></foreignObject></svg>')).to.equal('createVNode(32, "svg", null, createVNode(32, "foreignObject", null, createVNode(1, "div"), 2), 2);');
    });

    it('Should flag svg text elements', function () {
      expect(transform('<text x="1">hi</text>')).to.equal('createVNode(32, "text", null, "hi", 16, {\n  "x": "1"\n});');
    });

    it('Should flag camelCase svg tags', function () {
      expect(transform('<svg><linearGradient /><feGaussianBlur stdDeviation="2" /><textPath /><animateMotion /></svg>')).to.equal('createVNode(32, "svg", null, [createVNode(32, "linearGradient"), createVNode(32, "feGaussianBlur", null, null, 1, {\n  "stdDeviation": "2"\n}), createVNode(32, "textPath"), createVNode(32, "animateMotion")], 4);');
    });

    it('Should compile option elements as plain html elements', function () {
      expect(transform('<option>x</option>')).to.equal('createVNode(1, "option", null, "x", 16);');
    });
  });

  describe('this in arrow functions', function () {
    it('Should rewrite this.Foo to _this.Foo when arrow functions are compiled', function () {
      var code = transformWith({imports: true}, 'class A { m() { return () => <this.Foo/>; } }', es5);

      expect(code).to.contain('var _this = this;');
      expect(code).to.contain('return createComponentVNode(2, _this.Foo);');
    });

    it('Should rewrite this in opening and nested member tags', function () {
      var code = transformWith({imports: true}, 'class A { m() { return () => <this.foo.bar.qux><this.foo></this.foo></this.foo.bar.qux>; } }', es5);

      expect(code).to.contain('var _this = this;');
      expect(code).to.contain('createComponentVNode(2, _this.foo.bar.qux, {');
      expect(code).to.contain('children: createComponentVNode(2, _this.foo)');
    });

    it('Should rewrite this inside element children', function () {
      var code = transformWith({imports: true}, 'class A { m() { return () => <div>{this.x}</div>; } }', es5);

      expect(code).to.contain('return createVNode(1, "div", null, _this.x, 0);');
    });
  });

  describe('tag evaluation order', function () {
    it('Should read the outer component tag before evaluating its children', function () {
      expect(transform('<Tag>{((Tag = Other), v)}<Tag /></Tag>')).to.equal('createComponentVNode(2, Tag, {\n  children: [(Tag = Other, v), createComponentVNode(2, Tag)]\n});');
    });
  });

  describe('current behaviour (questionable)', function () {
    // React and Babel compile <this /> to a this reference
    it('Should compile <this /> as an element named "this"', function () {
      expect(transform('() => <this />')).to.equal('() => createVNode(1, "this");');
    });

    // Babel only treats tags starting with a-z as strings, so this would be a component there
    it('Should compile a lowercase non-ASCII tag as an element', function () {
      expect(transform('<é />')).to.equal('createVNode(1, "é");');
    });

    it('Should compile a lowercase non-ASCII word tag as an element', function () {
      expect(transform('<ünicode />')).to.equal('createVNode(1, "ünicode");');
    });

    it('Should treat any member expression ending in Fragment as a Fragment', function () {
      expect(transform('<x.Fragment>{a}</x.Fragment>')).to.equal('createFragment(a, 0);');
    });

    it('Should treat a deep member expression ending in Fragment as a Fragment', function () {
      expect(transform('<Foo.Bar.Fragment>x</Foo.Bar.Fragment>')).to.equal('createFragment([createTextVNode("x")], 4);');
    });

    // image is missing from lib/vNodeTypes.js; the runtime still derives the SVG namespace from the parent svg
    it('Should flag svg image as a plain html element', function () {
      expect(transform('<image xlinkHref="a.png" />')).to.equal('createVNode(1, "image", null, null, 1, {\n  "xlink:href": "a.png"\n});');
    });

    // Inferno has no MathML namespace support
    it('Should flag MathML as plain html elements', function () {
      expect(transform('<math><mi>x</mi></math>')).to.equal('createVNode(1, "math", null, createVNode(1, "mi", null, "x", 16), 2);');
    });
  });
});
