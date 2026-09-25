var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformWith = helpers.transformWith;
var es5 = helpers.es5;
var es5CommonJS = helpers.es5CommonJS;
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('Spread attributes', function () {
  describe('spread position', function () {
    it('Should keep a spread before other props', function () {
      expect(transform('<Component {...x} y={2} z />')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  ...x,\n  "y": 2,\n  "z": true\n}));');
    });

    it('Should keep a spread after other props', function () {
      expect(transform('<Component y={2} z { ... x } />')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  "y": 2,\n  "z": true,\n  ...x\n}));');
    });

    it('Should keep a spread between other props', function () {
      expect(transform('<Component y={2} { ... x } z />')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  "y": 2,\n  ...x,\n  "z": true\n}));');
    });

    it('Should keep the same spread twice', function () {
      expect(transform('<Component x={1} y="2" {...z} {...z}><Child /></Component>')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  "x": 1,\n  "y": "2",\n  ...z,\n  ...z,\n  children: createComponentVNode(2, Child)\n}));');
    });

    it('Should keep a sequence expression spread', function () {
      expect(transform('<Component x="1" {...(z = { y: 2 }, z)} z={3}>Text</Component>')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  "x": "1",\n  ...(z = {\n    y: 2\n  }, z),\n  "z": 3,\n  children: "Text"\n}));');
    });

    it('Should keep a null spread', function () {
      expect(transform('<div {...null} />')).to.equal('normalizeProps(createVNode(1, "div", null, null, 1, {\n  ...null\n}));');
    });

    it('Should keep a spread of a JSX element', function () {
      expect(transform('<div {...<span/>} />')).to.equal('normalizeProps(createVNode(1, "div", null, null, 1, {\n  ...createVNode(1, "span")\n}));');
    });

    it('Should keep an object literal spread containing __proto__', function () {
      expect(transform('<Foo {...{__proto__: a}} b="1" />')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...{\n    __proto__: a\n  },\n  "b": "1"\n}));');
    });

    it('Should keep a comment inside a spread', function () {
      expect(transform('<div {.../*i18n*/{ id: "hello" }} />')).to.equal('normalizeProps(createVNode(1, "div", null, null, 1, {\n  ... /*i18n*/{\n    id: "hello"\n  }\n}));');
    });

    it('Should compile JSX nested inside a spread expression', function () {
      expect(stripInfernoImport(transformTSX('<Foo {...{icon: <Icon<T> />}} />'))).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...{\n    icon: createComponentVNode(2, Icon)\n  }\n}));');
    });

    it('Should strip a type assertion from a spread', function () {
      expect(stripInfernoImport(transformTSX('<Foo {...p as any} />'))).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n}));');
    });

    it('Should strip a non-null assertion from a spread', function () {
      expect(stripInfernoImport(transformTSX('<Foo {...p!} a="1" />'))).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p,\n  "a": "1"\n}));');
    });

    it('Should strip satisfies from a spread', function () {
      expect(stripInfernoImport(transformTSX('<Foo {...(p satisfies object)} />'))).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n}));');
    });

    it('Should keep a spread on a generic component', function () {
      expect(stripInfernoImport(transformTSX('<Foo<Props> {...p} a={1} />'))).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p,\n  "a": 1\n}));');
    });
  });

  describe('spread with special props', function () {
    it('Should keep className, key and ref next to spreads', function () {
      expect(transform('<div {...a} {...b} className="x" key="k" ref={r}>{c}</div>')).to.equal('normalizeProps(createVNode(1, "div", "x", c, 0, {\n  ...a,\n  ...b\n}, "k", r));');
    });

    it('Should keep key next to a spread on a component', function () {
      expect(transform('<Foo {...p} key="k"/>')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n}, "k"));');
    });

    it('Should keep ref next to a spread on a component', function () {
      expect(transform('<Foo {...p} ref={r}/>')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n}, null, r));');
    });

    it('Should keep a children prop next to a spread on an element', function () {
      expect(transform('<div {...p} children="x"/>')).to.equal('normalizeProps(createVNode(1, "div", null, "x", 16, {\n  ...p\n}));');
    });

    it('Should keep dynamic children next to a spread', function () {
      expect(transform('<div {...p}>{a}{b}</div>')).to.equal('normalizeProps(createVNode(1, "div", null, [a, b], 0, {\n  ...p\n}));');
    });

    it('Should keep a component children prop next to a spread', function () {
      expect(transform('<Foo children={a} {...p} />')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  "children": a,\n  ...p\n}));');
    });

    it('Should prefer JSX children over a children prop next to a spread', function () {
      expect(transform('<Foo {...p} children={a}>b</Foo>')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p,\n  children: "b"\n}));');
    });

    it('Should keep an attribute after a spread', function () {
      expect(transform('<input {...props} type="radio" />')).to.equal('normalizeProps(createVNode(64, "input", null, null, 1, {\n  ...props,\n  "type": "radio"\n}));');
    });

    it('Should keep a spread of a conditional object', function () {
      expect(transform('<div {...(c ? {class: "x"} : {})} />')).to.equal('normalizeProps(createVNode(1, "div", null, null, 1, {\n  ...(c ? {\n    class: "x"\n  } : {})\n}));');
    });

    it('Should prefer JSX children over children from a spread', function () {
      expect(transform('<Foo {...p}>b</Foo>')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p,\n  children: "b"\n}));');
    });

    it('Should put JSX children after the spread on a generic component', function () {
      expect(stripInfernoImport(transformTSX('<Foo<T> {...p}><a/><b/></Foo>'))).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p,\n  children: [createVNode(1, "a"), createVNode(1, "b")]\n}));');
    });
  });

  describe('other compilation targets', function () {
    it('Should compile spreads with _objectSpread for ES5', function () {
      var code = transformWith({imports: true}, '<div {...p} a="1"/>', es5);

      expect(code).to.contain('normalizeProps(createVNode(1, "div", null, null, 1, _objectSpread(_objectSpread({}, p), {}, {\n  "a": "1"\n})));');
    });

    it('Should reference inferno helpers through the module namespace for CommonJS', function () {
      var code = transformWith({imports: true}, '<div {...p}/>', es5CommonJS);

      expect(code).to.contain('var _inferno = require("inferno");');
      expect(code).to.contain('(0, _inferno.normalizeProps)((0, _inferno.createVNode)(1, "div", null, null, 1, _objectSpread({}, p)));');
    });
  });

  describe('current behaviour (questionable)', function () {
    // Babel and oxc flatten this into plain props
    it('Should not flatten an object literal spread', function () {
      expect(transform('<Foo {...{a: 1}} />')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...{\n    a: 1\n  }\n}));');
    });

    // normalizeProps lets a key from the spread win either way; JSX order says the later one should
    it('Should compile a key before a spread like a key after it', function () {
      expect(transform('<Foo key="k" {...p}/>')).to.equal(transform('<Foo {...p} key="k"/>'));
      expect(transform('<Foo key="k" {...p}/>')).to.equal('normalizeProps(createComponentVNode(2, Foo, {\n  ...p\n}, "k"));');
    });

    // normalizeProps keeps this className even when the spread contains a later className
    it('Should pass className before a spread as the className argument', function () {
      expect(transform('<div className="x" {...p}/>')).to.equal('normalizeProps(createVNode(1, "div", "x", null, 1, {\n  ...p\n}));');
    });

    it('Should evaluate className before the other props', function () {
      expect(transform('<div onClick={a()} className={b()} key={c()} ref={d()} />')).to.equal('createVNode(1, "div", b(), null, 1, {\n  "onClick": a()\n}, c(), d());');
    });
  });
});
