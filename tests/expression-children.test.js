var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;

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
  });

  // An empty expression still counts as a dynamic child, so childFlags become 0 (UnknownChildren) instead of the static shape
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
