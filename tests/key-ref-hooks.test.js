var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('key, ref and onComponent hooks', function () {
  describe('ref', function () {
    it('Should pass ref to an element', function () {
      expect(transform('<div ref={a} />')).to.equal('newVNode(17, "div", null, null, null, null, a);');
    });

    it('Should pass ref and key to an element', function () {
      expect(transform('<div ref={a} key="k" />')).to.equal('newVNode(17, "div", null, null, null, "k", a);');
    });

    it('Should pass ref to an element with dynamic children', function () {
      expect(transform('<div ref={a}>{b}</div>')).to.equal('newVNode(1, "div", null, b, null, null, a);');
    });

    it('Should pass ref to a component', function () {
      expect(transform('<Foo ref={r} />')).to.equal('newComponentVNode(0, Foo, null, null, r);');
    });

    it('Should pass key and ref to a component', function () {
      expect(transform('<Foo key="k" ref={r} />')).to.equal('newComponentVNode(0, Foo, null, "k", r);');
    });

    it('Should pass a string ref', function () {
      expect(transform('<div ref="stringRef" />')).to.equal('newVNode(17, "div", null, null, null, null, "stringRef");');
    });

    it('Should omit null key and ref', function () {
      expect(transform('<div key={null} ref={null} />')).to.equal('newVNode(17, "div");');
      expect(transform('<Foo key={null} ref={null} />')).to.equal('newComponentVNode(0, Foo);');
    });

    it('Should pass ref and other props to a component', function () {
      expect(transform('<Component ref={ref} foo="56" />')).to.equal('newComponentVNode(0, Component, {\n  "foo": "56"\n}, null, ref);');
    });

    it('Should pass every argument to a component', function () {
      expect(transform('<Parent a="a" b={{b: "b"}} c={C} key="testKey" ref={testRef} />')).to.equal('newComponentVNode(0, Parent, {\n  "a": "a",\n  "b": {\n    b: "b"\n  },\n  "c": C\n}, "testKey", testRef);');
    });

    it('Should pass key and ref to a generic component', function () {
      expect(stripInfernoImport(transformTSX('<Foo<string> key="k" ref={r} />'))).to.equal('newComponentVNode(0, Foo, null, "k", r);');
    });
  });

  describe('key values', function () {
    it('Should pass an undefined key', function () {
      expect(transform('<div key={undefined} />')).to.equal('newVNode(17, "div", null, null, null, undefined);');
    });

    it('Should pass numeric and empty string keys', function () {
      expect(transform('<div key={0}><a key=""/><b key="x"/></div>')).to.equal('newVNode(33, "div", null, [newVNode(17, "a", null, null, null, ""), newVNode(17, "b", null, null, null, "x")], null, 0);');
    });

    it('Should pass an object key', function () {
      expect(transform('<div key={obj} />')).to.equal('newVNode(17, "div", null, null, null, obj);');
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

    it('Should strip type syntax from key and ref', function () {
      expect(stripInfernoImport(transformTSX('<div key={k!} ref={r as any} />'))).to.equal('newVNode(17, "div", null, null, null, k, r);');
    });

    it('Should strip satisfies from a key', function () {
      expect(stripInfernoImport(transformTSX('<Foo key={id satisfies string} />'))).to.equal('newComponentVNode(0, Foo, null, id);');
    });

    it('Should reject a valueless key on a generic component', function () {
      expect(function () {
        transformTSX('<Foo<string> key />');
      }).to.throw('Please provide an explicit key value. Using "key" as a shorthand for "key={true}" is not allowed.');
    });
  });

  describe('keyed children', function () {
    it('Should mark mixed keyed and unkeyed children as keyed', function () {
      expect(transform('<div><span key="k"/><span/></div>')).to.equal('newVNode(33, "div", null, [newVNode(17, "span", null, null, null, "k"), newVNode(17, "span")]);');
    });

    it('Should mark a single keyed child as a vnode child', function () {
      expect(transform('<div><span key="k"/></div>')).to.equal('newVNode(9, "div", null, newVNode(17, "span", null, null, null, "k"));');
    });

    it('Should mark duplicate sibling keys as keyed', function () {
      expect(transform('<><a key="a"/><a key="a"/></>')).to.equal('newFragment(288, [newVNode(17, "a", null, null, null, "a"), newVNode(17, "a", null, null, null, "a")]);');
    });

    it('Should not mark children as keyed when normalization is needed', function () {
      expect(transform('<div>{a}<span key="k"/></div>')).to.equal('newVNode(1, "div", null, [a, newVNode(17, "span", null, null, null, "k")]);');
    });

    it('Should not inspect keys of component children', function () {
      expect(transform('<Foo key="a"><Bar key="b"/><Bar key="c"/></Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: [newComponentVNode(0, Bar, null, "b"), newComponentVNode(0, Bar, null, "c")]\n}, "a");');
    });

    it('Should not detect keys passed through spread', function () {
      expect(transform('<div><Foo {...{key: "k"}}/><Foo {...{key: "j"}}/></div>')).to.equal('newVNode(5, "div", null, [normalizeProps(newComponentVNode(0, Foo, {\n  ...{\n    key: "k"\n  }\n})), normalizeProps(newComponentVNode(0, Foo, {\n  ...{\n    key: "j"\n  }\n}))]);');
    });

    it('Should mark self-closing keyed component children as keyed', function () {
      expect(stripInfernoImport(transformTSX('<div><Item<T> key={a} /><Item<T> key={b} /></div>'))).to.equal('newVNode(33, "div", null, [newComponentVNode(0, Item, null, a), newComponentVNode(0, Item, null, b)]);');
    });

    it('Should mark keyed children of an element with a spread as keyed', function () {
      expect(transform('<div {...p}><span key="a"></span><span key="b"></span></div>')).to.equal('normalizeProps(newVNode(33, "div", null, [newVNode(17, "span", null, null, null, "a"), newVNode(17, "span", null, null, null, "b")], {\n  ...p\n}));');
    });
  });

  describe('onComponent hooks', function () {
    it('Should move every onComponent hook into ref', function () {
      expect(transform('<Foo onComponentWillMount={a} onComponentWillUnmount={b} onComponentShouldUpdate={c} onComponentWillUpdate={d} onComponentDidUpdate={e} />')).to.equal('newComponentVNode(0, Foo, null, null, {\n  "onComponentWillMount": a,\n  "onComponentWillUnmount": b,\n  "onComponentShouldUpdate": c,\n  "onComponentWillUpdate": d,\n  "onComponentDidUpdate": e\n});');
    });

    it('Should move hooks into ref for member expression components', function () {
      expect(transform('<Foo.Bar onComponentDidMount={a} />')).to.equal('newComponentVNode(0, Foo.Bar, null, null, {\n  "onComponentDidMount": a\n});');
    });

    it('Should keep hooks as props on elements', function () {
      expect(transform('<div onComponentDidMount={f} />')).to.equal('newVNode(17, "div", null, null, {\n  "onComponentDidMount": f\n});');
    });

    it('Should merge ref into the hooks when ref comes before a hook', function () {
      expect(transform('<Foo ref={r} onComponentDidMount={m} />')).to.equal('newComponentVNode(0, Foo, null, null, {\n  ...r,\n  "onComponentDidMount": m\n});');
    });

    it('Should merge ref into the hooks when ref comes after the hooks', function () {
      expect(transform('<Foo onComponentDidMount={m} ref={r} />')).to.equal('newComponentVNode(0, Foo, null, null, {\n  ...r,\n  "onComponentDidMount": m\n});');
    });

    it('Should compile ref and hooks the same in any order', function () {
      expect(transform('<Foo ref={r} onComponentDidMount={m} />')).to.equal(transform('<Foo onComponentDidMount={m} ref={r} />'));
    });

    it('Should merge ref with several hooks, key and children', function () {
      expect(transform('<Foo key={i} ref={r} onComponentDidAppear={a} onComponentDidMount={b}>{i}</Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: i\n}, i, {\n  ...r,\n  "onComponentDidAppear": a,\n  "onComponentDidMount": b\n});');
    });

    it('Should move hooks next to spread props', function () {
      expect(transform('<Foo {...p} onComponentDidMount={m} />')).to.equal('normalizeProps(newComponentVNode(0, Foo, {\n  ...p\n}, null, {\n  "onComponentDidMount": m\n}));');
    });

    it('Should move hooks into ref for generic member expression components', function () {
      expect(stripInfernoImport(transformTSX('<Ns.Foo<T> onComponentDidMount={m} />'))).to.equal('newComponentVNode(0, Ns.Foo, null, null, {\n  "onComponentDidMount": m\n});');
    });

    it('Should merge ref into the hooks of a generic component', function () {
      expect(stripInfernoImport(transformTSX('<Foo<string> ref={r as any} onComponentDidMount={m} />'))).to.equal('newComponentVNode(0, Foo, null, null, {\n  ...r,\n  "onComponentDidMount": m\n});');
    });
  });

  describe('valueless ref', function () {
    var MESSAGE = 'Please provide an explicit ref value. Using "ref" as a shorthand for "ref={true}" is not allowed.';

    it('Should reject a valueless ref on an element', function () {
      expect(function () {
        transform('<div ref />');
      }).to.throw(MESSAGE);
    });

    it('Should reject a valueless ref on a component', function () {
      expect(function () {
        transform('<Foo ref />');
      }).to.throw(MESSAGE);
    });

    it('Should reject a valueless ref next to component hooks', function () {
      expect(function () {
        transform('<Foo ref onComponentDidMount={m} />');
      }).to.throw(MESSAGE);
    });

    it('Should reject a valueless ref on a generic component', function () {
      expect(function () {
        transformTSX('<Foo<string> ref />');
      }).to.throw(MESSAGE);
    });

    it('Should point the valueless ref error at the ref', function () {
      expect(function () {
        transform('<ul>\n  <li ref>a</li>\n</ul>');
      }).to.throw('unknown file: ' + MESSAGE + '\n  1 | <ul>\n> 2 |   <li ref>a</li>\n    |       ^^^');
    });
  });
});
