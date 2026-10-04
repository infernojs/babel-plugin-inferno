var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformWith = helpers.transformWith;
var es5 = helpers.es5;
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('Tag names', function () {
  describe('member expressions', function () {
    it('Should compile this.foo as a component', function () {
      expect(transform('<this.foo />')).to.equal('newComponentVNode(0, this.foo);');
    });

    it('Should compile a nested this member expression with children', function () {
      expect(transform('<this.foo.bar>x</this.foo.bar>')).to.equal('newComponentVNode(0, this.foo.bar, {\n  children: "x"\n});');
    });

    it('Should compile a deep member expression', function () {
      expect(transform('<a.b.c.d />')).to.equal('newComponentVNode(0, a.b.c.d);');
    });

    it('Should compile a lowercase member expression as a component', function () {
      expect(transform('<foo.bar />')).to.equal('newComponentVNode(0, foo.bar);');
    });

    it('Should compile a lowercase context provider as a component', function () {
      expect(transform('<ctx.Provider value={v}>{a}</ctx.Provider>')).to.equal('newComponentVNode(0, ctx.Provider, {\n  "value": v,\n  children: a\n});');
    });

    it('Should compile a member expression ending in this', function () {
      expect(transform('<a.this />')).to.equal('newComponentVNode(0, a.this);');
    });

    it('Should compile a this member expression ending in an uppercase name as a component', function () {
      expect(transform('<this.Foo />')).to.equal('newComponentVNode(0, this.Foo);');
    });

    it('Should compile a lowercase generic member expression as a component', function () {
      expect(stripInfernoImport(transformTSX('<icons.close<Props> size={1} />'))).to.equal('newComponentVNode(0, icons.close, {\n  "size": 1\n});');
    });
  });

  describe('identifier tags', function () {
    it('Should compile an underscore-prefixed tag as a component', function () {
      expect(transform('<_foo />')).to.equal('newComponentVNode(0, _foo);');
    });

    it('Should compile a dollar-prefixed tag as a component', function () {
      expect(transform('<$foo />')).to.equal('newComponentVNode(0, $foo);');
    });

    it('Should compile an underscore-prefixed uppercase tag as a component', function () {
      expect(transform('<_Foo />')).to.equal('newComponentVNode(0, _Foo);');
    });

    it('Should compile __proto__ as a component', function () {
      expect(transform('<__proto__ />')).to.equal('newComponentVNode(0, __proto__);');
    });

    it('Should compile an uppercase non-ASCII tag as a component', function () {
      expect(transform('<Ünicode />')).to.equal('newComponentVNode(0, Ünicode);');
    });

    it('Should compile an all-caps tag as a component', function () {
      expect(transform('<SVG />')).to.equal('newComponentVNode(0, SVG);');
    });

    it('Should compile a capitalised tag as a component', function () {
      expect(transform('<Svg />')).to.equal('newComponentVNode(0, Svg);');
    });

    it('Should not treat a lowercase fragment tag as a Fragment', function () {
      expect(transform('<fragment>a</fragment>')).to.equal('newVNode(3, "fragment", null, "a");');
    });

    it('Should not treat a Fragment-prefixed component as a Fragment', function () {
      expect(transform('<FragmentX>a</FragmentX>')).to.equal('newComponentVNode(0, FragmentX, {\n  children: "a"\n});');
    });

    it('Should compile a variable holding a tag name as a component', function () {
      expect(transform('const TagName = "div";\n<TagName />;')).to.equal('const TagName = "div";\nnewComponentVNode(0, TagName);');
    });
  });

  describe('Object.prototype names as tags', function () {
    it('Should compile <hasOwnProperty> as an element (babel should-handle-has-own-property-correctly)', function () {
      expect(transform('<hasOwnProperty>testing</hasOwnProperty>')).to.equal('newVNode(3, "hasOwnProperty", null, "testing");');
    });

    it('Should compile <constructor> as an element', function () {
      expect(transform('<constructor />')).to.equal('newVNode(17, "constructor");');
    });

    it('Should compile <toString> as an element', function () {
      expect(transform('<toString />')).to.equal('newVNode(17, "toString");');
    });

    it('Should compile <valueOf> as an element', function () {
      expect(transform('<valueOf />')).to.equal('newVNode(17, "valueOf");');
    });
  });

  describe('namespaced tags', function () {
    it('Should reject namespaced svg tags', function () {
      expect(function () {
        transform('<svg:rect />');
      }).to.throw('Namespace tags like <svg:rect> are not supported.');
    });

    it('Should reject namespaced tags with namespaced attributes', function () {
      expect(function () {
        transform('<f:image n:attr />');
      }).to.throw('Namespace tags like <f:image> are not supported.');
    });

    it('Should reject namespaced component tags', function () {
      expect(function () {
        transform('<Namespace:Component />');
      }).to.throw('Namespace tags like <Namespace:Component> are not supported.');
    });

    it('Should point the namespace tag error at the tag name', function () {
      expect(function () {
        transform('<div>\n  <svg:rect />\n</div>');
      }).to.throw('> 2 |   <svg:rect />\n    |    ^^^^^^^^');
    });
  });

  describe('tags that are not valid identifiers', function () {
    it('Should compile an uppercase hyphenated tag as an element', function () {
      expect(transform('<Foo-bar />')).to.equal('newVNode(17, "Foo-bar");');
    });

    it('Should compile a mixed-case hyphenated tag with children (babel-parser basic/7)', function () {
      expect(transform('<AbC-def test="x">bar</AbC-def>')).to.equal('newVNode(3, "AbC-def", null, "bar", {\n  "test": "x"\n});');
    });

    it('Should compile an underscore-prefixed hyphenated tag as an element', function () {
      expect(transform('<_foo-bar />')).to.equal('newVNode(17, "_foo-bar");');
    });

    it('Should compile a hyphenated member expression property as a computed access', function () {
      expect(transform('<Foo.bar-baz />')).to.equal('newComponentVNode(0, Foo["bar-baz"]);');
    });

    it('Should compile a hyphenated property in a deeper member expression', function () {
      expect(transform('<Foo.bar-baz.Qux>x</Foo.bar-baz.Qux>')).to.equal('newComponentVNode(0, Foo["bar-baz"].Qux, {\n  children: "x"\n});');
    });

    it('Should compile a hyphenated property of this', function () {
      expect(transform('<this.foo-bar />')).to.equal('newComponentVNode(0, this["foo-bar"]);');
    });

    it('Should reject a hyphenated member expression object', function () {
      expect(function () {
        transform('<a-b.c />');
      }).to.throw('a-b is not a valid variable name for a member expression tag.\n> 1 | <a-b.c />\n    |  ^^^');
    });
  });

  describe('custom elements', function () {
    it('Should compile a hyphenated tag as an element', function () {
      expect(transform('<my-element foo="bar" />')).to.equal('newVNode(17, "my-element", null, null, {\n  "foo": "bar"\n});');
    });

    it('Should apply className and htmlFor handling to custom elements', function () {
      expect(transform('<my-element className="x" htmlFor="y" />')).to.equal('newVNode(17, "my-element", "x", null, {\n  "for": "y"\n});');
    });

    it('Should compile x-component as an element', function () {
      expect(transform('<x-component />')).to.equal('newVNode(17, "x-component");');
    });

    it('Should compile a custom element with a boolean attribute', function () {
      expect(transform('<o-checkbox checked />')).to.equal('newVNode(17, "o-checkbox", null, null, {\n  "checked": true\n});');
    });
  });

  describe('element flags', function () {
    it('Should flag select elements', function () {
      expect(transform('<select value={v}><option>1</option></select>')).to.equal('newVNode(4104, "select", null, newVNode(3, "option", null, "1"), {\n  "value": v\n});');
    });

    it('Should flag textarea elements without children', function () {
      expect(transform('<textarea value={v} />')).to.equal('newVNode(2064, "textarea", null, null, {\n  "value": v\n});');
    });

    it('Should flag input elements', function () {
      expect(transform('<input disabled />')).to.equal('newVNode(528, "input", null, null, {\n  "disabled": true\n});');
    });

    it('Should flag svg children like foreignObject and keep html inside', function () {
      expect(transform('<svg><foreignObject><div/></foreignObject></svg>')).to.equal('newVNode(72, "svg", null, newVNode(72, "foreignObject", null, newVNode(17, "div")));');
    });

    it('Should flag svg text elements', function () {
      expect(transform('<text x="1">hi</text>')).to.equal('newVNode(66, "text", null, "hi", {\n  "x": "1"\n});');
    });

    it('Should flag camelCase svg tags', function () {
      expect(transform('<svg><linearGradient /><feGaussianBlur stdDeviation="2" /><textPath /><animateMotion /></svg>')).to.equal('newVNode(68, "svg", null, [newVNode(80, "linearGradient"), newVNode(80, "feGaussianBlur", null, null, {\n  "stdDeviation": "2"\n}), newVNode(80, "textPath"), newVNode(80, "animateMotion")]);');
    });

    it('Should compile option elements as plain html elements', function () {
      expect(transform('<option>x</option>')).to.equal('newVNode(3, "option", null, "x");');
    });
  });

  describe('this in arrow functions', function () {
    it('Should rewrite this.Foo to _this.Foo when arrow functions are compiled', function () {
      var code = transformWith({imports: true}, 'class A { m() { return () => <this.Foo/>; } }', es5);

      expect(code).to.contain('var _this = this;');
      expect(code).to.contain('return newComponentVNode(0, _this.Foo);');
    });

    it('Should rewrite this in opening and nested member tags', function () {
      var code = transformWith({imports: true}, 'class A { m() { return () => <this.foo.bar.qux><this.foo></this.foo></this.foo.bar.qux>; } }', es5);

      expect(code).to.contain('var _this = this;');
      expect(code).to.contain('newComponentVNode(0, _this.foo.bar.qux, {');
      expect(code).to.contain('children: newComponentVNode(0, _this.foo)');
    });

    it('Should rewrite this inside element children', function () {
      var code = transformWith({imports: true}, 'class A { m() { return () => <div>{this.x}</div>; } }', es5);

      expect(code).to.contain('return newVNode(1, "div", null, _this.x);');
    });
  });

  describe('tag evaluation order', function () {
    it('Should read the outer component tag before evaluating its children', function () {
      expect(transform('<Tag>{((Tag = Other), v)}<Tag /></Tag>')).to.equal('newComponentVNode(0, Tag, {\n  children: [(Tag = Other, v), newComponentVNode(0, Tag)]\n});');
    });
  });

  describe('type arguments', function () {
    it('Should drop object type arguments and keep the props', function () {
      expect(stripInfernoImport(transformTSX('<Foo<{a: number}> a={1} />'))).to.equal('newComponentVNode(0, Foo, {\n  "a": 1\n});');
    });

    it('Should drop the type arguments of a generic member expression component with children', function () {
      expect(stripInfernoImport(transformTSX('<Ns.Foo<T>>x</Ns.Foo>'))).to.equal('newComponentVNode(0, Ns.Foo, {\n  children: "x"\n});');
    });
  });

  describe('current behaviour (questionable)', function () {
    // React and Babel compile <this /> to a this reference
    it('Should compile <this /> as an element named "this"', function () {
      expect(transform('() => <this />')).to.equal('() => newVNode(17, "this");');
    });

    // Babel only treats tags starting with a-z as strings, so this would be a component there
    it('Should compile a lowercase non-ASCII tag as an element', function () {
      expect(transform('<é />')).to.equal('newVNode(17, "é");');
    });

    it('Should compile a lowercase non-ASCII word tag as an element', function () {
      expect(transform('<ünicode />')).to.equal('newVNode(17, "ünicode");');
    });

    it('Should treat any member expression ending in Fragment as a Fragment', function () {
      expect(transform('<x.Fragment>{a}</x.Fragment>')).to.equal('newFragment(256, a);');
    });

    it('Should treat a deep member expression ending in Fragment as a Fragment', function () {
      expect(transform('<Foo.Bar.Fragment>x</Foo.Bar.Fragment>')).to.equal('newFragment(260, [newTextVNode("x")]);');
    });

    // image is missing from lib/vNodeTypes.js; the runtime still derives the SVG namespace from the parent svg
    it('Should flag svg image as a plain html element', function () {
      expect(transform('<image xlinkHref="a.png" />')).to.equal('newVNode(17, "image", null, null, {\n  "xlink:href": "a.png"\n});');
    });

    // Inferno has no MathML namespace support
    it('Should flag MathML as plain html elements', function () {
      expect(transform('<math><mi>x</mi></math>')).to.equal('newVNode(9, "math", null, newVNode(3, "mi", null, "x"));');
    });
  });
});
