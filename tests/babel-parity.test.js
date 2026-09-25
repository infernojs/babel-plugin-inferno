// Cases mirrored from Babel's fixtures. Titles name the fixture they come from.
// - ~/git/babel/packages/babel-plugin-transform-react-jsx/test/fixtures/react/
// - ~/git/babel/packages/babel-parser/test/fixtures/jsx/
// - ~/git/babel/packages/babel-plugin-transform-react-constant-elements/test/fixtures/constant-elements/

var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var expectValidJS = helpers.expectValidJS;

describe('Babel parity', function () {
  describe('transform-react-jsx fixtures', function () {
    it('should-convert-simple-tags', function () {
      expect(transform('var x = <div></div>;')).to.equal('var x = createVNode(1, "div");');
    });

    it('should-convert-simple-text', function () {
      expect(transform('var x = <div>text</div>;')).to.equal('var x = createVNode(1, "div", null, "text", 16);');
    });

    it('should-allow-js-namespacing', function () {
      expect(transform('<Namespace.Component />;')).to.equal('createComponentVNode(2, Namespace.Component);');
    });

    it('should-allow-deeper-js-namespacing', function () {
      expect(transform('<Namespace.DeepNamespace.Component />;')).to.equal('createComponentVNode(2, Namespace.DeepNamespace.Component);');
    });

    it('should-transform-known-hyphenated-tags', function () {
      expect(transform('<font-face />;')).to.equal('createVNode(32, "font-face");');
    });

    it('this-tag-name', function () {
      expect(transform('var div = <this.foo>test</this.foo>;')).to.equal('var div = createComponentVNode(2, this.foo, {\n  children: "test"\n});');
    });

    it('assignment', function () {
      expect(transform('var div = <Component {...props} foo="bar" />')).to.equal('var div = normalizeProps(createComponentVNode(2, Component, {\n  ...props,\n  "foo": "bar"\n}));');
    });

    it('should-allow-elements-as-attributes', function () {
      expect(transform('<div attr=<div /> />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "attr": createVNode(1, "div")\n});');
    });

    it('should-handle-attributed-elements', function () {
      expect(transform('var HelloMessage = React.createClass({\n  render: function() {\n    return <div>Hello {this.props.name}</div>;\n  }\n});\n\nReact.render(<HelloMessage name={\n  <span>\n    Sebastian\n  </span>\n} />, mountNode);')).to.equal('var HelloMessage = React.createClass({\n  render: function () {\n    return createVNode(1, "div", null, [createTextVNode("Hello "), this.props.name], 0);\n  }\n});\nReact.render(createComponentVNode(2, HelloMessage, {\n  "name": createVNode(1, "span", null, "Sebastian", 16)\n}), mountNode);');
    });

    it('should-not-add-quotes-to-identifier-names', function () {
      expect(transform('var e = <F aaa new const var default foo-bar/>;')).to.equal('var e = createComponentVNode(2, F, {\n  "aaa": true,\n  "new": true,\n  "const": true,\n  "var": true,\n  "default": true,\n  "foo-bar": true\n});');
    });

    it('should-quote-jsx-attributes', function () {
      expect(transform('<button data-value=\'a value\'>Button</button>;')).to.equal('createVNode(1, "button", null, "Button", 16, {\n  "data-value": "a value"\n});');
    });

    it('should-not-mangle-expressioncontainer-attribute-values', function () {
      expect(transform('<button data-value={"a value\\n  with\\nnewlines\\n   and spaces"}>Button</button>;')).to.equal('createVNode(1, "button", null, "Button", 16, {\n  "data-value": "a value\\n  with\\nnewlines\\n   and spaces"\n});');
    });

    it('duplicate-props', function () {
      expect(transform('<p prop prop></p>;\n<p {...{prop, prop}}></p>;\n<p prop {...{prop}}></p>;\n<p {...{prop}} prop></p>;')).to.equal('createVNode(1, "p", null, null, 1, {\n  "prop": true,\n  "prop": true\n});\nnormalizeProps(createVNode(1, "p", null, null, 1, {\n  ...{\n    prop,\n    prop\n  }\n}));\nnormalizeProps(createVNode(1, "p", null, null, 1, {\n  "prop": true,\n  ...{\n    prop\n  }\n}));\nnormalizeProps(createVNode(1, "p", null, null, 1, {\n  ...{\n    prop\n  },\n  "prop": true\n}));');
    });

    it('flattens-spread', function () {
      expect(transform('<p {...props}>text</p>;\n<div {...props}>{contents}</div>;\n<img alt="" {...{src, title}} />;\n<blockquote {...{cite}}>{items}</blockquote>;')).to.equal('normalizeProps(createVNode(1, "p", null, "text", 16, {\n  ...props\n}));\nnormalizeProps(createVNode(1, "div", null, contents, 0, {\n  ...props\n}));\nnormalizeProps(createVNode(1, "img", null, null, 1, {\n  "alt": "",\n  ...{\n    src,\n    title\n  }\n}));\nnormalizeProps(createVNode(1, "blockquote", null, items, 0, {\n  ...{\n    cite\n  }\n}));');
    });

    it('handle-spread-with-proto', function () {
      expect(transform('<p {...{__proto__: null}}>text</p>;\n<div {...{"__proto__": null}}>{contents}</div>;')).to.equal('normalizeProps(createVNode(1, "p", null, "text", 16, {\n  ...{\n    __proto__: null\n  }\n}));\nnormalizeProps(createVNode(1, "div", null, contents, 0, {\n  ...{\n    "__proto__": null\n  }\n}));');
    });

    it('wraps-props-in-react-spread-for-first-spread-attributes', function () {
      expect(transform('<Component { ... x } y\n={2 } z />')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  ...x,\n  "y": 2,\n  "z": true\n}));');
    });

    it('wraps-props-in-react-spread-for-last-spread-attributes', function () {
      expect(transform('<Component y={2} z { ... x } />')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  "y": 2,\n  "z": true,\n  ...x\n}));');
    });

    it('wraps-props-in-react-spread-for-middle-spread-attributes', function () {
      expect(transform('<Component y={2} { ... x } z />')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  "y": 2,\n  ...x,\n  "z": true\n}));');
    });

    it('should-escape-xhtml-jsxtext', function () {
      var code = transform('<div>wow</div>;\n<div>wôw</div>;\n<div>w & w</div>;\n<div>w &amp; w</div>;\n<div>w &nbsp; w</div>;\n<div>this should not parse as unicode: \u00A0</div>;\n<div>this should parse as nbsp: \u00A0 </div>;\n<div>this should parse as unicode: {\'\u00A0 \'}</div>;\n<div>w &lt; w</div>;');

      expect(code).to.equal('createVNode(1, "div", null, "wow", 16);\ncreateVNode(1, "div", null, "wôw", 16);\ncreateVNode(1, "div", null, "w & w", 16);\ncreateVNode(1, "div", null, "w & w", 16);\ncreateVNode(1, "div", null, "w \\xA0 w", 16);\ncreateVNode(1, "div", null, "this should not parse as unicode: \\xA0", 16);\ncreateVNode(1, "div", null, "this should parse as nbsp: \\xA0 ", 16);\ncreateVNode(1, "div", null, [createTextVNode("this should parse as unicode: "), createTextVNode(\'\u00A0 \')], 0);\ncreateVNode(1, "div", null, "w < w", 16);');
      expectValidJS(code);
    });

    it('should-not-strip-nbsp-even-coupled-with-other-whitespace', function () {
      expect(transform('<div>&nbsp; </div>;')).to.equal('createVNode(1, "div", null, "\\xA0 ", 16);');
    });

    it('should-not-strip-tags-with-a-single-child-of-nbsp', function () {
      expect(transform('<div>&nbsp;</div>;')).to.equal('createVNode(1, "div", null, "\\xA0", 16);');
    });

    it('weird-symbols', function () {
      expect(transform('class MobileHomeActivityTaskPriorityIcon extends React.PureComponent {\n  render() {\n    return <Text>&nbsp;{this.props.value}&nbsp;</Text>;\n  }\n}')).to.equal('class MobileHomeActivityTaskPriorityIcon extends React.PureComponent {\n  render() {\n    return createComponentVNode(2, Text, {\n      children: ["\\xA0", this.props.value, "\\xA0"]\n    });\n  }\n}');
    });

    it('dont-coerce-expression-containers', function () {
      expect(transform('<Text>\n  To get started, edit index.ios.js!!!{"\\n"}\n  Press Cmd+R to reload\n</Text>')).to.equal('createComponentVNode(2, Text, {\n  children: ["To get started, edit index.ios.js!!!", "\\n", "Press Cmd+R to reload"]\n});');
    });

    it('concatenates-adjacent-string-literals', function () {
      expect(transform('var x =\n  <div>\n    foo\n    {"bar"}\n    baz\n    <div>\n      buz\n      bang\n    </div>\n    qux\n    {null}\n    quack\n  </div>')).to.equal('var x = createVNode(1, "div", null, [createTextVNode("foo"), createTextVNode("bar"), createTextVNode("baz"), createVNode(1, "div", null, "buz bang", 16), createTextVNode("qux"), null, createTextVNode("quack")], 0);');
    });

    it('should-insert-commas-after-expressions-before-whitespace', function () {
      expect(transform('var x =\n  <div\n    attr1={\n      "foo" + "bar"\n    }\n    attr2={\n      "foo" + "bar" +\n\n      "baz" + "bug"\n    }\n    attr3={\n      "foo" + "bar" +\n      "baz" + "bug"\n      // Extra line here.\n    }\n    attr4="baz">\n  </div>')).to.equal('var x = createVNode(1, "div", null, null, 1, {\n  "attr1": "foo" + "bar",\n  "attr2": "foo" + "bar" + "baz" + "bug",\n  "attr3": "foo" + "bar" + "baz" + "bug"\n  // Extra line here.\n  ,\n  "attr4": "baz"\n});');
    });

    it('should-have-correct-comma-in-nested-children', function () {
      expect(transform('var x = <div>\n  <div><br /></div>\n  <Component>{foo}<br />{bar}</Component>\n  <br />\n</div>;')).to.equal('var x = createVNode(1, "div", null, [createVNode(1, "div", null, createVNode(1, "br"), 2), createComponentVNode(2, Component, {\n  children: [foo, createVNode(1, "br"), bar]\n}), createVNode(1, "br")], 4);');
    });

    it('should-avoid-wrapping-in-extra-parens-if-not-needed', function () {
      expect(transform('var x = <div>\n  <Component />\n</div>;\n\nvar x = <div>\n  {props.children}\n</div>;\n\nvar x = <Composite>\n  {props.children}\n</Composite>;\n\nvar x = <Composite>\n  <Composite2 />\n</Composite>;')).to.equal('var x = createVNode(1, "div", null, createComponentVNode(2, Component), 2);\nvar x = createVNode(1, "div", null, props.children, 0);\nvar x = createComponentVNode(2, Composite, {\n  children: props.children\n});\nvar x = createComponentVNode(2, Composite, {\n  children: createComponentVNode(2, Composite2)\n});');
    });

    it('should-allow-nested-fragments', function () {
      expect(transform('<div>\n  <  >\n    <>\n      <span>Hello</span>\n      <span>world</span>\n    </>\n    <>\n      <span>Goodbye</span>\n      <span>world</span>\n    </>\n  </>\n</div>')).to.equal('createVNode(1, "div", null, createFragment([createFragment([createVNode(1, "span", null, "Hello", 16), createVNode(1, "span", null, "world", 16)], 4), createFragment([createVNode(1, "span", null, "Goodbye", 16), createVNode(1, "span", null, "world", 16)], 4)], 4), 2);');
    });

    it('comments', function () {
      var code = transform('<div {.../*i18n*/{ id: "hello" }} />;\n<Trans /*test1 */a="1"/**test2 */b="2"/**test3 */ />;');

      expect(code).to.equal('normalizeProps(createVNode(1, "div", null, null, 1, {\n  ... /*i18n*/{\n    id: "hello"\n  }\n}));\ncreateComponentVNode(2, Trans, {\n  "a": "1",\n  "b": "2"\n});');
      expectValidJS(code);
    });
  });

  describe('babel-parser jsx fixtures', function () {
    it('basic/3', function () {
      expect(transform('<a n:foo="bar"> {value} <b><c /></b></a>')).to.equal('createVNode(1, "a", null, [createTextVNode(" "), value, createTextVNode(" "), createVNode(1, "b", null, createVNode(1, "c"), 2)], 0, {\n  "n:foo": "bar"\n});');
    });

    it('basic/6', function () {
      expect(transform('<日本語></日本語>')).to.equal('createComponentVNode(2, 日本語);');
    });

    it('basic/11', function () {
      expect(transform('<div>@test content</div>')).to.equal('createVNode(1, "div", null, "@test content", 16);');
    });

    it('basic/12', function () {
      expect(transform('<div><br />7x invalid-js-identifier</div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "br"), createTextVNode("7x invalid-js-identifier")], 4);');
    });

    it('basic/16', function () {
      expect(transform('(<div />) < x;')).to.equal('createVNode(1, "div") < x;');
    });

    it('basic/asi', function () {
      expect(transform('let x\n<div />')).to.equal('let x;\ncreateVNode(1, "div");');
    });

    it('keyword-tag', function () {
      expect(transform('<var></var>')).to.equal('createVNode(1, "var");');
    });

    it('yield-tag', function () {
      expect(transform('function* g() { yield <a></a>; }')).to.equal('function* g() {\n  yield createVNode(1, "a");\n}');
    });

    it('entity', function () {
      expect(transform('<A>&#x1f4a9;</A>')).to.equal('createComponentVNode(2, A, {\n  children: "💩"\n});');
    });

    it('nonentity', function () {
      expect(transform('<A>&#x1g4q9;</A>')).to.equal('createComponentVNode(2, A, {\n  children: "&#x1g4q9;"\n});');
    });

    it('html-entities/code-point', function () {
      expect(transform('<div>&#1234;&#xABC;&#x10ffff;</div>')).to.equal('createVNode(1, "div", null, "Ӓ઼􏿿", 16);');
    });

    it('html-entities/invalid', function () {
      expect(transform('<div>&amp &ampa; &amp ; &xamp; &#0_0;</div>')).to.equal('createVNode(1, "div", null, "&amp &ampa; &amp ; &xamp; &#0_0;", 16);');
    });

    it('fragment-5', function () {
      expect(transform('<\n// comment1\n/* comment2 */\n><div/></>')).to.equal('createFragment([createVNode(1, "div")], 4);');
    });

    it('fragment-6', function () {
      expect(transform('<><div>JSXElement</div>JSXText{"JSXExpressionContainer"}</>')).to.equal('createFragment([createVNode(1, "div", null, "JSXElement", 16), createTextVNode("JSXText"), createTextVNode("JSXExpressionContainer")], 0);');
    });

    it('regression/1', function () {
      expect(transform('<p>foo <a href="test"> bar</a> baz</p>')).to.equal('createVNode(1, "p", null, [createTextVNode("foo "), createVNode(1, "a", null, " bar", 16, {\n  "href": "test"\n}), createTextVNode(" baz")], 4);');
    });

    it('regression/4', function () {
      expect(transform('<div>/text</div>')).to.equal('createVNode(1, "div", null, "/text", 16);');
    });

    it('regression/issue-2083', function () {
      expect(transform('true ? (<div />) : <div />')).to.equal('true ? createVNode(1, "div") : createVNode(1, "div");');
    });

    it('issue-8891', function () {
      expect(transform('<div prop={{ function: "test" }} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "prop": {\n    function: "test"\n  }\n});');
    });

    it('issue-11387', function () {
      expect(transform('<div>{(this?.class, this.class, this?.function, this.function)}</div>')).to.equal('createVNode(1, "div", null, (this?.class, this.class, this?.function, this.function), 0);');
    });

    it('tsx/assignment-in-conditional-expression', function () {
      expect(transform('a == 3 ? (a = <h1>123</h1>) : (a = <h1>abc</h1>)')).to.equal('a == 3 ? a = createVNode(1, "h1", null, "123", 16) : a = createVNode(1, "h1", null, "abc", 16);');
    });
  });

  describe('transform-react-constant-elements fixtures', function () {
    it('magical-bindings (super)', function () {
      expect(transform('class A extends B { m() { return <super.Foo/>; } }')).to.equal('class A extends B {\n  m() {\n    return createComponentVNode(2, super.Foo);\n  }\n}');
    });

    it('magical-bindings (new.target)', function () {
      expect(transform('function f() { return <new.target.Foo/>; }')).to.equal('function f() {\n  return createComponentVNode(2, new.target.Foo);\n}');
    });

    it('magical-bindings (arguments)', function () {
      expect(transform('function f() { return <arguments.Foo/>; }')).to.equal('function f() {\n  return createComponentVNode(2, arguments.Foo);\n}');
    });

    it('lowercase-member-expression (transform-react-inline-elements)', function () {
      expect(transform('<form.TestComponent />')).to.equal('createComponentVNode(2, form.TestComponent);');
    });
  });

  describe('current behaviour (questionable)', function () {
    // Babel compiles <this /> to a this reference
    it('arrow-functions (compiles <this /> to an element)', function () {
      expect(transform('var foo = function () {\n  return () => <this />;\n};\n\nvar bar = function () {\n  return () => <this.foo />;\n};')).to.equal('var foo = function () {\n  return () => createVNode(1, "this");\n};\nvar bar = function () {\n  return () => createComponentVNode(2, this.foo);\n};');
    });
  });
});
