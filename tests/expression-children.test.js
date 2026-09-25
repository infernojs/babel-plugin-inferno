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
      expect(transform('<Foo>{/* c */}</Foo>')).to.equal('createComponentVNode(2, Foo);');
    });

    it('Should create an empty fragment for a fragment with only a comment', function () {
      expect(transform('<>{/* c */}</>')).to.equal('createFragment();');
    });

    it('Should ignore a comment next to a dynamic child', function () {
      expect(transform('<div>{/* c */}{a}</div>')).to.equal('createVNode(1, "div", null, a, 0);');
    });

    it('Should ignore a comment between dynamic children', function () {
      expect(transform('<div>{a}{/* x */}{b}</div>')).to.equal('createVNode(1, "div", null, [a, b], 0);');
    });

    it('Should ignore a comment next to component text', function () {
      expect(transform('<Foo>{/* c */}text</Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: "text"\n});');
    });
  });

  describe('literal expressions', function () {
    it('Should pass a string literal child as is', function () {
      expect(transform('<div>{"literal"}</div>')).to.equal('createVNode(1, "div", null, "literal", 0);');
    });

    it('Should pass several string literal children as is', function () {
      expect(transform('<div>{"a"}{"b"}</div>')).to.equal('createVNode(1, "div", null, ["a", "b"], 0);');
    });

    it('Should pass a number child', function () {
      expect(transform('<div>{1}</div>')).to.equal('createVNode(1, "div", null, 1, 0);');
    });

    it('Should pass a null child', function () {
      expect(transform('<div>{null}</div>')).to.equal('createVNode(1, "div", null, null, 0);');
    });

    it('Should pass an undefined child', function () {
      expect(transform('<div>{undefined}</div>')).to.equal('createVNode(1, "div", null, undefined, 0);');
    });

    it('Should pass a boolean child', function () {
      expect(transform('<div>{true}</div>')).to.equal('createVNode(1, "div", null, true, 0);');
    });

    it('Should pass a template literal child', function () {
      expect(transform('<div>{`tpl ${x}`}</div>')).to.equal('createVNode(1, "div", null, `tpl ${x}`, 0);');
    });

    it('Should pass string literals containing JSX text special characters', function () {
      expect(transform('<div>{">"}{"}"}</div>')).to.equal('createVNode(1, "div", null, [">", "}"], 0);');
    });
  });

  describe('dynamic expressions', function () {
    it('Should compile JSX inside a logical expression', function () {
      expect(transform('<div>{cond && <span/>}</div>')).to.equal('createVNode(1, "div", null, cond && createVNode(1, "span"), 0);');
    });

    it('Should compile JSX inside a ternary', function () {
      expect(transform('<div>{cond ? <a/> : <b/>}</div>')).to.equal('createVNode(1, "div", null, cond ? createVNode(1, "a") : createVNode(1, "b"), 0);');
    });

    it('Should compile keyed JSX returned from map', function () {
      expect(transform('<div>{list.map(i => <li key={i}>{i}</li>)}</div>')).to.equal('createVNode(1, "div", null, list.map(i => createVNode(1, "li", null, i, 0, null, i)), 0);');
    });

    it('Should compile an array literal of keyed JSX', function () {
      expect(transform('<div>{[<a key="1"/>, <b key="2"/>]}</div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "a", null, null, 1, null, "1"), createVNode(1, "b", null, null, 1, null, "2")], 0);');
    });

    it('Should compile an array literal of unkeyed components', function () {
      expect(transform('<div>{[<C/>, <C/>]}</div>')).to.equal('createVNode(1, "div", null, [createComponentVNode(2, C), createComponentVNode(2, C)], 0);');
    });

    it('Should pass a function as component children', function () {
      expect(transform('<Foo>{(v) => <div>{v}</div>}</Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: v => createVNode(1, "div", null, v, 0)\n});');
    });

    it('Should pass an object child as is', function () {
      expect(transform('<div>{ {a} }</div>')).to.equal('createVNode(1, "div", null, {\n  a\n}, 0);');
    });

    it('Should compile an expression container holding a spread element', function () {
      expect(transform('<div>{<div {...test} />}</div>')).to.equal('createVNode(1, "div", null, normalizeProps(createVNode(1, "div", null, null, 1, {\n  ...test\n})), 0);');
    });

    it('Should keep a parenthesized sequence expression', function () {
      expect(transform('<div>{(console.log("foo"), JSON.stringify(props))}</div>')).to.equal('createVNode(1, "div", null, (console.log("foo"), JSON.stringify(props)), 0);');
    });

    it('Should keep optional chaining in a sequence expression', function () {
      expect(transform('<div>{(this?.class, this.class)}</div>')).to.equal('createVNode(1, "div", null, (this?.class, this.class), 0);');
    });

    it('Should pass a typed function as children of a component with type arguments', function () {
      expect(stripInfernoImport(transformTSX('<Foo<string>>{(v: string) => <div>{v}</div>}</Foo>'))).to.equal('createComponentVNode(2, Foo, {\n  children: v => createVNode(1, "div", null, v, 0)\n});');
    });
  });

  // An empty expression still counts as a dynamic child, so childFlags become 0 (UnknownChildren) instead of the static shape
  describe('spread children', function () {
    it('Should spread children of an element', function () {
      expect(transform('<div>{...children}</div>')).to.equal('createVNode(1, "div", null, [...children], 0);');
    });

    it('Should spread children of a component', function () {
      expect(transform('<Foo>{...children}</Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: [...children]\n});');
    });

    it('Should spread children of a fragment', function () {
      expect(transform('<>{...children}</>')).to.equal('createFragment([...children], 0);');
    });

    it('Should spread children of a keyed Fragment', function () {
      expect(transform('<Fragment key="k">{...a}</Fragment>')).to.equal('createFragment([...a], 0, "k");');
    });

    it('Should spread several children in order (oxc spread-children-multiple-automatic)', function () {
      expect(transform('<div>{...[1, 2]}{...[3, 4]}</div>')).to.equal('createVNode(1, "div", null, [...[1, 2], ...[3, 4]], 0);');
    });

    it('Should spread children around a static element (oxc spread-children-mixed-automatic)', function () {
      expect(transform('<div>{...a}<span/>{...b}</div>')).to.equal('createVNode(1, "div", null, [...a, createVNode(1, "span"), ...b], 0);');
    });

    it('Should spread a JSX element child (babel constant-elements)', function () {
      expect(transform('<div>{...<span/>}</div>')).to.equal('createVNode(1, "div", null, [...createVNode(1, "span")], 0);');
    });

    it('Should spread children next to text', function () {
      expect(transform('<div>text{...a}</div>')).to.equal('createVNode(1, "div", null, [createTextVNode("text"), ...a], 0);');
    });

    it('Should spread component children next to text', function () {
      expect(transform('<Foo>text{...a}</Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: ["text", ...a]\n});');
    });

    it('Should normalize spread children next to a keyed child', function () {
      expect(transform('<div><span key="k"/>{...a}</div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "span", null, null, 1, null, "k"), ...a], 0);');
    });

    it('Should use the child flag given for spread children', function () {
      expect(transform('<div $HasNonKeyedChildren>{...a}</div>')).to.equal('createVNode(1, "div", null, [...a], 4);');
    });

    it('Should compile spread children for ES5 targets', function () {
      expect(transformWith({imports: true}, '<div>{...a}</div>', es5)).to.contain('createVNode(1, "div", null, _toConsumableArray(a), 0);');
    });

    it('Should spread children given with a type assertion', function () {
      expect(stripInfernoImport(transformTSX('<div>{...(items as Item[])}</div>'))).to.equal('createVNode(1, "div", null, [...items], 0);');
    });

    // Array.prototype.concat flattens array arguments, so the plain child is wrapped to keep an array child nested
    it('Should keep the order of spread and plain children for ES5 targets', function () {
      var code = transformWith({imports: false}, 'var vNode = <div>{...a}{b}{...c}</div>;', es5);
      var Inferno = {createVNode: function (flags, type, className, children, childFlags) { return {children: children, childFlags: childFlags}; }};
      var vNode = new Function('Inferno', 'a', 'b', 'c', code + '\nreturn vNode;')(Inferno, [1], [2], [3]);

      expect(code).to.contain('createVNode(1, "div", null, [].concat(_toConsumableArray(a), [b], _toConsumableArray(c)), 0);');
      expect(vNode.children).to.deep.equal([1, [2], 3]);
    });
  });

  describe('children prop', function () {
    it('Should normalize a string children prop', function () {
      expect(transform('<div children={"txt"} />')).to.equal('createVNode(1, "div", null, "txt", 0);');
    });

    it('Should normalize an array children prop', function () {
      expect(transform('<div children={[a, b]} />')).to.equal('createVNode(1, "div", null, [a, b], 0);');
    });

    it('Should normalize an unknown children prop expression', function () {
      expect(transform('<div children={a} />')).to.equal('createVNode(1, "div", null, a, 0);');
    });

    it('Should use a JSX element children prop given without braces', function () {
      expect(transform('<div children=<span/> />')).to.equal('createVNode(1, "div", null, createVNode(1, "span"), 2);');
    });

    it('Should use a JSX fragment children prop given without braces', function () {
      expect(transform('<div children=<>{a}</> />')).to.equal('createVNode(1, "div", null, createFragment(a, 0), 2);');
    });

    it('Should trust $HasVNodeChildren for a children prop expression', function () {
      expect(transform('<div $HasVNodeChildren children={a} />')).to.equal('createVNode(1, "div", null, a, 2);');
    });

    it('Should normalize a Fragment children prop like Fragment children', function () {
      expect(transform('<Fragment children={a} />')).to.equal('createFragment(a, 0);');
    });

    it('Should normalize a JSX Fragment children prop', function () {
      expect(transform('<Fragment children={<span/>} />')).to.equal('createFragment(createVNode(1, "span"), 0);');
    });

    it('Should use a JSX element children prop given in braces', function () {
      expect(transform('<div children={<span/>} />')).to.equal('createVNode(1, "div", null, createVNode(1, "span"), 2);');
    });

    it('Should create no children for a null children prop', function () {
      expect(transform('<div children={null} />')).to.equal('createVNode(1, "div");');
    });

    it('Should normalize a children prop expression with a type assertion', function () {
      expect(stripInfernoImport(transformTSX('<div children={a as Child} />'))).to.equal('createVNode(1, "div", null, a, 0);');
    });
  });

  describe('type assertions', function () {
    it('Should compile an as expression child', function () {
      expect(stripInfernoImport(transformTSX('<div>{value as string}</div>'))).to.equal('createVNode(1, "div", null, value, 0);');
    });

    it('Should compile a non-null assertion child', function () {
      expect(stripInfernoImport(transformTSX('<div>{maybe!}</div>'))).to.equal('createVNode(1, "div", null, maybe, 0);');
    });

    it('Should compile a satisfies expression child', function () {
      expect(stripInfernoImport(transformTSX('<div>{(x satisfies Item)}</div>'))).to.equal('createVNode(1, "div", null, x, 0);');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should mark an element with only a comment child as UnknownChildren', function () {
      expect(transform('<div>{/* comment */}</div>')).to.equal('createVNode(1, "div", null, null, 0);');
    });

    it('Should mark an element with an empty expression as UnknownChildren', function () {
      expect(transform('<div>{}</div>')).to.equal('createVNode(1, "div", null, null, 0);');
    });

    it('Should wrap text next to a comment in createTextVNode with UnknownChildren', function () {
      expect(transform('<div>{/* c */}text</div>')).to.equal('createVNode(1, "div", null, createTextVNode("text"), 0);');
    });

    it('Should mark static siblings around a comment as UnknownChildren', function () {
      expect(transform('<div><span/>{/* c */}<span/></div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "span"), createVNode(1, "span")], 0);');
    });
  });
});
