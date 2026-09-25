var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;

describe('key, ref and onComponent hooks', function () {
  describe('ref', function () {
    it('Should pass ref to an element', function () {
      expect(transform('<div ref={a} />')).to.equal('createVNode(1, "div", null, null, 1, null, null, a);');
    });

    it('Should pass ref and key to an element', function () {
      expect(transform('<div ref={a} key="k" />')).to.equal('createVNode(1, "div", null, null, 1, null, "k", a);');
    });

    it('Should pass ref to an element with dynamic children', function () {
      expect(transform('<div ref={a}>{b}</div>')).to.equal('createVNode(1, "div", null, b, 0, null, null, a);');
    });

    it('Should pass ref to a component', function () {
      expect(transform('<Foo ref={r} />')).to.equal('createComponentVNode(2, Foo, null, null, r);');
    });

    it('Should pass key and ref to a component', function () {
      expect(transform('<Foo key="k" ref={r} />')).to.equal('createComponentVNode(2, Foo, null, "k", r);');
    });

    it('Should pass a string ref', function () {
      expect(transform('<div ref="stringRef" />')).to.equal('createVNode(1, "div", null, null, 1, null, null, "stringRef");');
    });

    it('Should pass null key and ref', function () {
      expect(transform('<div key={null} ref={null} />')).to.equal('createVNode(1, "div", null, null, 1, null, null, null);');
    });

    it('Should pass ref and other props to a component', function () {
      expect(transform('<Component ref={ref} foo="56" />')).to.equal('createComponentVNode(2, Component, {\n  "foo": "56"\n}, null, ref);');
    });

    it('Should pass every argument to a component', function () {
      expect(transform('<Parent a="a" b={{b: "b"}} c={C} key="testKey" ref={testRef} />')).to.equal('createComponentVNode(2, Parent, {\n  "a": "a",\n  "b": {\n    b: "b"\n  },\n  "c": C\n}, "testKey", testRef);');
    });
  });

  describe('key values', function () {
    it('Should pass an undefined key', function () {
      expect(transform('<div key={undefined} />')).to.equal('createVNode(1, "div", null, null, 1, null, undefined);');
    });

    it('Should pass numeric and empty string keys', function () {
      expect(transform('<div key={0}><a key=""/><b key="x"/></div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "a", null, null, 1, null, ""), createVNode(1, "b", null, null, 1, null, "x")], 8, null, 0);');
    });

    it('Should pass an object key', function () {
      expect(transform('<div key={obj} />')).to.equal('createVNode(1, "div", null, null, 1, null, obj);');
    });

    it('Should reject a valueless key on an element', function () {
      expect(function () {
        transform('<div key />');
      }).to.throw('Please provide an explicit key value. Using "key" as a shorthand for "key={true}" is not allowed.');
    });

    it('Should reject a valueless key on a component', function () {
      expect(function () {
        transform('<Foo key />');
      }).to.throw('Please provide an explicit key value. Using "key" as a shorthand for "key={true}" is not allowed.');
    });

    it('Should reject a valueless key inside an array (babel should-disallow-valueless-key)', function () {
      expect(function () {
        transform('[<div key></div>]');
      }).to.throw('Please provide an explicit key value. Using "key" as a shorthand for "key={true}" is not allowed.');
    });

    it('Should point the valueless key error at the key', function () {
      expect(function () {
        transform('<ul>\n  <li key>a</li>\n</ul>');
      }).to.throw('> 2 |   <li key>a</li>\n    |       ^^^');
    });
  });

  describe('keyed children', function () {
    it('Should mark mixed keyed and unkeyed children as keyed', function () {
      expect(transform('<div><span key="k"/><span/></div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "span", null, null, 1, null, "k"), createVNode(1, "span")], 8);');
    });

    it('Should mark a single keyed child as a vnode child', function () {
      expect(transform('<div><span key="k"/></div>')).to.equal('createVNode(1, "div", null, createVNode(1, "span", null, null, 1, null, "k"), 2);');
    });

    it('Should mark duplicate sibling keys as keyed', function () {
      expect(transform('<><a key="a"/><a key="a"/></>')).to.equal('createFragment([createVNode(1, "a", null, null, 1, null, "a"), createVNode(1, "a", null, null, 1, null, "a")], 8);');
    });

    it('Should not mark children as keyed when normalization is needed', function () {
      expect(transform('<div>{a}<span key="k"/></div>')).to.equal('createVNode(1, "div", null, [a, createVNode(1, "span", null, null, 1, null, "k")], 0);');
    });

    it('Should not inspect keys of component children', function () {
      expect(transform('<Foo key="a"><Bar key="b"/><Bar key="c"/></Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: [createComponentVNode(2, Bar, null, "b"), createComponentVNode(2, Bar, null, "c")]\n}, "a");');
    });

    it('Should not detect keys passed through spread', function () {
      expect(transform('<div><Foo {...{key: "k"}}/><Foo {...{key: "j"}}/></div>')).to.equal('createVNode(1, "div", null, [normalizeProps(createComponentVNode(2, Foo, {\n  ...{\n    key: "k"\n  }\n})), normalizeProps(createComponentVNode(2, Foo, {\n  ...{\n    key: "j"\n  }\n}))], 4);');
    });
  });

  describe('onComponent hooks', function () {
    it('Should move every onComponent hook into ref', function () {
      expect(transform('<Foo onComponentWillMount={a} onComponentWillUnmount={b} onComponentShouldUpdate={c} onComponentWillUpdate={d} onComponentDidUpdate={e} />')).to.equal('createComponentVNode(2, Foo, null, null, {\n  "onComponentWillMount": a,\n  "onComponentWillUnmount": b,\n  "onComponentShouldUpdate": c,\n  "onComponentWillUpdate": d,\n  "onComponentDidUpdate": e\n});');
    });

    it('Should move hooks into ref for member expression components', function () {
      expect(transform('<Foo.Bar onComponentDidMount={a} />')).to.equal('createComponentVNode(2, Foo.Bar, null, null, {\n  "onComponentDidMount": a\n});');
    });

    it('Should keep hooks as props on elements', function () {
      expect(transform('<div onComponentDidMount={f} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "onComponentDidMount": f\n});');
    });

    it('Should merge ref into the hooks when ref comes before a hook', function () {
      expect(transform('<Foo ref={r} onComponentDidMount={m} />')).to.equal('createComponentVNode(2, Foo, null, null, {\n  ...r,\n  "onComponentDidMount": m\n});');
    });

    it('Should merge ref into the hooks when ref comes after the hooks', function () {
      expect(transform('<Foo onComponentDidMount={m} ref={r} />')).to.equal('createComponentVNode(2, Foo, null, null, {\n  ...r,\n  "onComponentDidMount": m\n});');
    });

    it('Should compile ref and hooks the same in any order', function () {
      expect(transform('<Foo ref={r} onComponentDidMount={m} />')).to.equal(transform('<Foo onComponentDidMount={m} ref={r} />'));
    });

    it('Should merge ref with several hooks, key and children', function () {
      expect(transform('<Foo key={i} ref={r} onComponentDidAppear={a} onComponentDidMount={b}>{i}</Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: i\n}, i, {\n  ...r,\n  "onComponentDidAppear": a,\n  "onComponentDidMount": b\n});');
    });

    it('Should move hooks next to spread props', function () {
      expect(transform('<Foo {...p} onComponentDidMount={m} />')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n}, null, {\n  "onComponentDidMount": m\n}));');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should pass true as ref for a valueless ref', function () {
      expect(transform('<div ref />')).to.equal('createVNode(1, "div", null, null, 1, null, null, true);');
    });
  });
});
