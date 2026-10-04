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

describe('Expression children', function () {
  describe('empty expressions', function () {
    it('Should create no children for a component with only a comment', function () {
      expect(transform('<Foo>{/* c */}</Foo>')).to.equal('newComponentVNode(0, Foo);');
    });

    it('Should create an empty fragment for a fragment with only a comment', function () {
      expect(transform('<>{/* c */}</>')).to.equal('newFragment(272);');
    });

    it('Should ignore a comment next to a dynamic child', function () {
      expect(transform('<div>{/* c */}{a}</div>')).to.equal('newVNode(1, "div", null, a);');
    });

    it('Should ignore a comment between dynamic children', function () {
      expect(transform('<div>{a}{/* x */}{b}</div>')).to.equal('newVNode(1, "div", null, [a, b]);');
    });

    it('Should ignore a comment next to component text', function () {
      expect(transform('<Foo>{/* c */}text</Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: "text"\n});');
    });
  });

  describe('literal expressions', function () {
    it('Should pass a string literal child as is', function () {
      expect(transform('<div>{"literal"}</div>')).to.equal('newVNode(1, "div", null, "literal");');
    });

    it('Should pass several string literal children as is', function () {
      expect(transform('<div>{"a"}{"b"}</div>')).to.equal('newVNode(1, "div", null, ["a", "b"]);');
    });

    it('Should pass a number child', function () {
      expect(transform('<div>{1}</div>')).to.equal('newVNode(1, "div", null, 1);');
    });

    it('Should omit a null child', function () {
      expect(transform('<div>{null}</div>')).to.equal('newVNode(1, "div");');
    });

    it('Should pass an undefined child', function () {
      expect(transform('<div>{undefined}</div>')).to.equal('newVNode(1, "div", null, undefined);');
    });

    it('Should pass a boolean child', function () {
      expect(transform('<div>{true}</div>')).to.equal('newVNode(1, "div", null, true);');
    });

    it('Should pass a template literal child', function () {
      expect(transform('<div>{`tpl ${x}`}</div>')).to.equal('newVNode(1, "div", null, `tpl ${x}`);');
    });

    it('Should pass string literals containing JSX text special characters', function () {
      expect(transform('<div>{">"}{"}"}</div>')).to.equal('newVNode(1, "div", null, [">", "}"]);');
    });
  });

  describe('dynamic expressions', function () {
    it('Should compile JSX inside a logical expression', function () {
      expect(transform('<div>{cond && <span/>}</div>')).to.equal('newVNode(1, "div", null, cond && newVNode(17, "span"));');
    });

    it('Should compile JSX inside a ternary', function () {
      expect(transform('<div>{cond ? <a/> : <b/>}</div>')).to.equal('newVNode(1, "div", null, cond ? newVNode(17, "a") : newVNode(17, "b"));');
    });

    it('Should compile keyed JSX returned from map', function () {
      expect(transform('<div>{list.map(i => <li key={i}>{i}</li>)}</div>')).to.equal('newVNode(1, "div", null, list.map(i => newVNode(1, "li", null, i, null, i)));');
    });

    it('Should compile an array literal of keyed JSX', function () {
      expect(transform('<div>{[<a key="1"/>, <b key="2"/>]}</div>')).to.equal('newVNode(1, "div", null, [newVNode(17, "a", null, null, null, "1"), newVNode(17, "b", null, null, null, "2")]);');
    });

    it('Should compile an array literal of unkeyed components', function () {
      expect(transform('<div>{[<C/>, <C/>]}</div>')).to.equal('newVNode(1, "div", null, [newComponentVNode(0, C), newComponentVNode(0, C)]);');
    });

    it('Should pass a function as component children', function () {
      expect(transform('<Foo>{(v) => <div>{v}</div>}</Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: v => newVNode(1, "div", null, v)\n});');
    });

    it('Should pass an object child as is', function () {
      expect(transform('<div>{ {a} }</div>')).to.equal('newVNode(1, "div", null, {\n  a\n});');
    });

    it('Should compile an expression container holding a spread element', function () {
      expect(transform('<div>{<div {...test} />}</div>')).to.equal('newVNode(1, "div", null, normalizeProps(newVNode(17, "div", null, null, {\n  ...test\n})));');
    });

    it('Should keep a parenthesized sequence expression', function () {
      expect(transform('<div>{(console.log("foo"), JSON.stringify(props))}</div>')).to.equal('newVNode(1, "div", null, (console.log("foo"), JSON.stringify(props)));');
    });

    it('Should keep optional chaining in a sequence expression', function () {
      expect(transform('<div>{(this?.class, this.class)}</div>')).to.equal('newVNode(1, "div", null, (this?.class, this.class));');
    });

    it('Should pass a typed function as children of a component with type arguments', function () {
      expect(stripInfernoImport(transformTSX('<Foo<string>>{(v: string) => <div>{v}</div>}</Foo>'))).to.equal('newComponentVNode(0, Foo, {\n  children: v => newVNode(1, "div", null, v)\n});');
    });
  });

  // An empty expression still counts as a dynamic child, so childFlags become 0 (UnknownChildren) instead of the static shape
  describe('spread children', function () {
    it('Should spread children of an element', function () {
      expect(transform('<div>{...children}</div>')).to.equal('newVNode(1, "div", null, [...children]);');
    });

    it('Should spread children of a component', function () {
      expect(transform('<Foo>{...children}</Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: [...children]\n});');
    });

    it('Should spread children of a fragment', function () {
      expect(transform('<>{...children}</>')).to.equal('newFragment(256, [...children]);');
    });

    it('Should spread children of a keyed Fragment', function () {
      expect(transform('<Fragment key="k">{...a}</Fragment>')).to.equal('newFragment(256, [...a], "k");');
    });

    it('Should spread several children in order (oxc spread-children-multiple-automatic)', function () {
      expect(transform('<div>{...[1, 2]}{...[3, 4]}</div>')).to.equal('newVNode(1, "div", null, [...[1, 2], ...[3, 4]]);');
    });

    it('Should spread children around a static element (oxc spread-children-mixed-automatic)', function () {
      expect(transform('<div>{...a}<span/>{...b}</div>')).to.equal('newVNode(1, "div", null, [...a, newVNode(17, "span"), ...b]);');
    });

    it('Should spread a JSX element child (babel constant-elements)', function () {
      expect(transform('<div>{...<span/>}</div>')).to.equal('newVNode(1, "div", null, [...newVNode(17, "span")]);');
    });

    it('Should spread children next to text', function () {
      expect(transform('<div>text{...a}</div>')).to.equal('newVNode(1, "div", null, [newTextVNode("text"), ...a]);');
    });

    it('Should spread component children next to text', function () {
      expect(transform('<Foo>text{...a}</Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: ["text", ...a]\n});');
    });

    it('Should normalize spread children next to a keyed child', function () {
      expect(transform('<div><span key="k"/>{...a}</div>')).to.equal('newVNode(1, "div", null, [newVNode(17, "span", null, null, null, "k"), ...a]);');
    });

    it('Should use the child flag given for spread children', function () {
      expect(transform('<div $HasNonKeyedChildren>{...a}</div>')).to.equal('newVNode(5, "div", null, [...a]);');
    });

    it('Should compile spread children for ES5 targets', function () {
      expect(transformWith({imports: true}, '<div>{...a}</div>', es5)).to.contain('newVNode(1, "div", null, _toConsumableArray(a));');
    });

    it('Should spread children given with a type assertion', function () {
      expect(stripInfernoImport(transformTSX('<div>{...(items as Item[])}</div>'))).to.equal('newVNode(1, "div", null, [...items]);');
    });

    // Array.prototype.concat flattens array arguments, so the plain child is wrapped to keep an array child nested
    it('Should keep the order of spread and plain children for ES5 targets', function () {
      var code = transformWith({imports: false}, 'var vNode = <div>{...a}{b}{...c}</div>;', es5);
      var Inferno = {newVNode: function (flags, type, className, children) { return {children: children}; }};
      var vNode = new Function('Inferno', 'a', 'b', 'c', code + '\nreturn vNode;')(Inferno, [1], [2], [3]);

      expect(code).to.contain('newVNode(1, "div", null, [].concat(_toConsumableArray(a), [b], _toConsumableArray(c)));');
      expect(vNode.children).to.deep.equal([1, [2], 3]);
    });
  });

  describe('children prop', function () {
    it('Should normalize a string children prop', function () {
      expect(transform('<div children={"txt"} />')).to.equal('newVNode(1, "div", null, "txt");');
    });

    it('Should normalize an array children prop', function () {
      expect(transform('<div children={[a, b]} />')).to.equal('newVNode(1, "div", null, [a, b]);');
    });

    it('Should normalize an unknown children prop expression', function () {
      expect(transform('<div children={a} />')).to.equal('newVNode(1, "div", null, a);');
    });

    it('Should use a JSX element children prop given without braces', function () {
      expect(transform('<div children=<span/> />')).to.equal('newVNode(9, "div", null, newVNode(17, "span"));');
    });

    it('Should use a JSX fragment children prop given without braces', function () {
      expect(transform('<div children=<>{a}</> />')).to.equal('newVNode(9, "div", null, newFragment(256, a));');
    });

    it('Should trust $HasVNodeChildren for a children prop expression', function () {
      expect(transform('<div $HasVNodeChildren children={a} />')).to.equal('newVNode(9, "div", null, a);');
    });

    it('Should normalize a Fragment children prop like Fragment children', function () {
      expect(transform('<Fragment children={a} />')).to.equal('newFragment(256, a);');
    });

    it('Should normalize a JSX Fragment children prop', function () {
      expect(transform('<Fragment children={<span/>} />')).to.equal('newFragment(256, newVNode(17, "span"));');
    });

    it('Should use a JSX element children prop given in braces', function () {
      expect(transform('<div children={<span/>} />')).to.equal('newVNode(9, "div", null, newVNode(17, "span"));');
    });

    it('Should create no children for a null children prop', function () {
      expect(transform('<div children={null} />')).to.equal('newVNode(17, "div");');
    });

    it('Should normalize a children prop expression with a type assertion', function () {
      expect(stripInfernoImport(transformTSX('<div children={a as Child} />'))).to.equal('newVNode(1, "div", null, a);');
    });
  });

  describe('type assertions', function () {
    it('Should compile an as expression child', function () {
      expect(stripInfernoImport(transformTSX('<div>{value as string}</div>'))).to.equal('newVNode(1, "div", null, value);');
    });

    it('Should compile a non-null assertion child', function () {
      expect(stripInfernoImport(transformTSX('<div>{maybe!}</div>'))).to.equal('newVNode(1, "div", null, maybe);');
    });

    it('Should compile a satisfies expression child', function () {
      expect(stripInfernoImport(transformTSX('<div>{(x satisfies Item)}</div>'))).to.equal('newVNode(1, "div", null, x);');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should mark an element with only a comment child as UnknownChildren', function () {
      expect(transform('<div>{/* comment */}</div>')).to.equal('newVNode(1, "div");');
    });

    it('Should mark an element with an empty expression as UnknownChildren', function () {
      expect(transform('<div>{}</div>')).to.equal('newVNode(1, "div");');
    });

    it('Should wrap text next to a comment in createTextVNode with UnknownChildren', function () {
      expect(transform('<div>{/* c */}text</div>')).to.equal('newVNode(1, "div", null, newTextVNode("text"));');
    });

    it('Should mark static siblings around a comment as UnknownChildren', function () {
      expect(transform('<div><span/>{/* c */}<span/></div>')).to.equal('newVNode(1, "div", null, [newVNode(17, "span"), newVNode(17, "span")]);');
    });
  });
});
