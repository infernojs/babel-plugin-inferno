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
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('Babel parity', function () {
  describe('transform-react-jsx fixtures', function () {
    it('should-convert-simple-tags', function () {
      expect(transform('var x = <div></div>;')).to.equal('var x = newVNode(17, "div");');
    });

    it('should-convert-simple-text', function () {
      expect(transform('var x = <div>text</div>;')).to.equal('var x = newVNode(3, "div", null, "text");');
    });

    it('should-allow-js-namespacing', function () {
      expect(transform('<Namespace.Component />;')).to.equal('newComponentVNode(0, Namespace.Component);');
    });

    it('should-allow-deeper-js-namespacing', function () {
      expect(transform('<Namespace.DeepNamespace.Component />;')).to.equal('newComponentVNode(0, Namespace.DeepNamespace.Component);');
    });

    it('should-transform-known-hyphenated-tags', function () {
      expect(transform('<font-face />;')).to.equal('newVNode(80, "font-face");');
    });

    it('this-tag-name', function () {
      expect(transform('var div = <this.foo>test</this.foo>;')).to.equal('var div = newComponentVNode(0, this.foo, {\n  children: "test"\n});');
    });

    it('assignment', function () {
      expect(transform('var div = <Component {...props} foo="bar" />')).to.equal('var div = normalizeProps(newComponentVNode(0, Component, {\n  ...props,\n  "foo": "bar"\n}));');
    });

    it('should-allow-elements-as-attributes', function () {
      expect(transform('<div attr=<div /> />')).to.equal('newVNode(17, "div", null, null, {\n  "attr": newVNode(17, "div")\n});');
    });

    it('should-handle-attributed-elements', function () {
      expect(transform('var HelloMessage = React.createClass({\n  render: function() {\n    return <div>Hello {this.props.name}</div>;\n  }\n});\n\nReact.render(<HelloMessage name={\n  <span>\n    Sebastian\n  </span>\n} />, mountNode);')).to.equal('var HelloMessage = React.createClass({\n  render: function () {\n    return newVNode(1, "div", null, [newTextVNode("Hello "), this.props.name]);\n  }\n});\nReact.render(newComponentVNode(0, HelloMessage, {\n  "name": newVNode(3, "span", null, "Sebastian")\n}), mountNode);');
    });

    it('should-not-add-quotes-to-identifier-names', function () {
      expect(transform('var e = <F aaa new const var default foo-bar/>;')).to.equal('var e = newComponentVNode(0, F, {\n  "aaa": true,\n  "new": true,\n  "const": true,\n  "var": true,\n  "default": true,\n  "foo-bar": true\n});');
    });

    it('should-quote-jsx-attributes', function () {
      expect(transform('<button data-value=\'a value\'>Button</button>;')).to.equal('newVNode(3, "button", null, "Button", {\n  "data-value": "a value"\n});');
    });

    it('should-not-mangle-expressioncontainer-attribute-values', function () {
      expect(transform('<button data-value={"a value\\n  with\\nnewlines\\n   and spaces"}>Button</button>;')).to.equal('newVNode(3, "button", null, "Button", {\n  "data-value": "a value\\n  with\\nnewlines\\n   and spaces"\n});');
    });

    it('duplicate-props (spread variants)', function () {
      expect(transform('<p {...{prop, prop}}></p>;\n<p prop {...{prop}}></p>;\n<p {...{prop}} prop></p>;')).to.equal('normalizeProps(newVNode(17, "p", null, null, {\n  ...{\n    prop,\n    prop\n  }\n}));\nnormalizeProps(newVNode(17, "p", null, null, {\n  "prop": true,\n  ...{\n    prop\n  }\n}));\nnormalizeProps(newVNode(17, "p", null, null, {\n  ...{\n    prop\n  },\n  "prop": true\n}));');
    });

    // Babel keeps both copies; repeated attributes are a compile error here
    it('duplicate-props (repeated attribute)', function () {
      expect(function () {
        transform('<p prop prop></p>;');
      }).to.throw('Multiple prop props are not supported. Remove the duplicate prop prop.');
    });

    it('flattens-spread', function () {
      expect(transform('<p {...props}>text</p>;\n<div {...props}>{contents}</div>;\n<img alt="" {...{src, title}} />;\n<blockquote {...{cite}}>{items}</blockquote>;')).to.equal('normalizeProps(newVNode(3, "p", null, "text", {\n  ...props\n}));\nnormalizeProps(newVNode(1, "div", null, contents, {\n  ...props\n}));\nnormalizeProps(newVNode(17, "img", null, null, {\n  "alt": "",\n  ...{\n    src,\n    title\n  }\n}));\nnormalizeProps(newVNode(1, "blockquote", null, items, {\n  ...{\n    cite\n  }\n}));');
    });

    it('handle-spread-with-proto', function () {
      expect(transform('<p {...{__proto__: null}}>text</p>;\n<div {...{"__proto__": null}}>{contents}</div>;')).to.equal('normalizeProps(newVNode(3, "p", null, "text", {\n  ...{\n    __proto__: null\n  }\n}));\nnormalizeProps(newVNode(1, "div", null, contents, {\n  ...{\n    "__proto__": null\n  }\n}));');
    });

    it('wraps-props-in-react-spread-for-first-spread-attributes', function () {
      expect(transform('<Component { ... x } y\n={2 } z />')).to.equal('normalizeProps(newComponentVNode(0, Component, {\n  ...x,\n  "y": 2,\n  "z": true\n}));');
    });

    it('wraps-props-in-react-spread-for-last-spread-attributes', function () {
      expect(transform('<Component y={2} z { ... x } />')).to.equal('normalizeProps(newComponentVNode(0, Component, {\n  "y": 2,\n  "z": true,\n  ...x\n}));');
    });

    it('wraps-props-in-react-spread-for-middle-spread-attributes', function () {
      expect(transform('<Component y={2} { ... x } z />')).to.equal('normalizeProps(newComponentVNode(0, Component, {\n  "y": 2,\n  ...x,\n  "z": true\n}));');
    });

    it('should-escape-xhtml-jsxtext', function () {
      var code = transform('<div>wow</div>;\n<div>wôw</div>;\n<div>w & w</div>;\n<div>w &amp; w</div>;\n<div>w &nbsp; w</div>;\n<div>this should not parse as unicode: \u00A0</div>;\n<div>this should parse as nbsp: \u00A0 </div>;\n<div>this should parse as unicode: {\'\u00A0 \'}</div>;\n<div>w &lt; w</div>;');

      expect(code).to.equal('newVNode(3, "div", null, "wow");\nnewVNode(3, "div", null, "wôw");\nnewVNode(3, "div", null, "w & w");\nnewVNode(3, "div", null, "w & w");\nnewVNode(3, "div", null, "w \\xA0 w");\nnewVNode(3, "div", null, "this should not parse as unicode: \\xA0");\nnewVNode(3, "div", null, "this should parse as nbsp: \\xA0 ");\nnewVNode(1, "div", null, [newTextVNode("this should parse as unicode: "), newTextVNode(\'\u00A0 \')]);\nnewVNode(3, "div", null, "w < w");');
      expectValidJS(code);
    });

    it('should-not-strip-nbsp-even-coupled-with-other-whitespace', function () {
      expect(transform('<div>&nbsp; </div>;')).to.equal('newVNode(3, "div", null, "\\xA0 ");');
    });

    it('should-not-strip-tags-with-a-single-child-of-nbsp', function () {
      expect(transform('<div>&nbsp;</div>;')).to.equal('newVNode(3, "div", null, "\\xA0");');
    });

    it('weird-symbols', function () {
      expect(transform('class MobileHomeActivityTaskPriorityIcon extends React.PureComponent {\n  render() {\n    return <Text>&nbsp;{this.props.value}&nbsp;</Text>;\n  }\n}')).to.equal('class MobileHomeActivityTaskPriorityIcon extends React.PureComponent {\n  render() {\n    return newComponentVNode(0, Text, {\n      children: ["\\xA0", this.props.value, "\\xA0"]\n    });\n  }\n}');
    });

    it('dont-coerce-expression-containers', function () {
      expect(transform('<Text>\n  To get started, edit index.ios.js!!!{"\\n"}\n  Press Cmd+R to reload\n</Text>')).to.equal('newComponentVNode(0, Text, {\n  children: ["To get started, edit index.ios.js!!!", "\\n", "Press Cmd+R to reload"]\n});');
    });

    it('concatenates-adjacent-string-literals', function () {
      expect(transform('var x =\n  <div>\n    foo\n    {"bar"}\n    baz\n    <div>\n      buz\n      bang\n    </div>\n    qux\n    {null}\n    quack\n  </div>')).to.equal('var x = newVNode(1, "div", null, [newTextVNode("foo"), newTextVNode("bar"), newTextVNode("baz"), newVNode(3, "div", null, "buz bang"), newTextVNode("qux"), null, newTextVNode("quack")]);');
    });

    it('should-insert-commas-after-expressions-before-whitespace', function () {
      expect(transform('var x =\n  <div\n    attr1={\n      "foo" + "bar"\n    }\n    attr2={\n      "foo" + "bar" +\n\n      "baz" + "bug"\n    }\n    attr3={\n      "foo" + "bar" +\n      "baz" + "bug"\n      // Extra line here.\n    }\n    attr4="baz">\n  </div>')).to.equal('var x = newVNode(17, "div", null, null, {\n  "attr1": "foo" + "bar",\n  "attr2": "foo" + "bar" + "baz" + "bug",\n  "attr3": "foo" + "bar" + "baz" + "bug"\n  // Extra line here.\n  ,\n  "attr4": "baz"\n});');
    });

    it('should-have-correct-comma-in-nested-children', function () {
      expect(transform('var x = <div>\n  <div><br /></div>\n  <Component>{foo}<br />{bar}</Component>\n  <br />\n</div>;')).to.equal('var x = newVNode(5, "div", null, [newVNode(9, "div", null, newVNode(17, "br")), newComponentVNode(0, Component, {\n  children: [foo, newVNode(17, "br"), bar]\n}), newVNode(17, "br")]);');
    });

    it('should-avoid-wrapping-in-extra-parens-if-not-needed', function () {
      expect(transform('var x = <div>\n  <Component />\n</div>;\n\nvar x = <div>\n  {props.children}\n</div>;\n\nvar x = <Composite>\n  {props.children}\n</Composite>;\n\nvar x = <Composite>\n  <Composite2 />\n</Composite>;')).to.equal('var x = newVNode(9, "div", null, newComponentVNode(0, Component));\nvar x = newVNode(1, "div", null, props.children);\nvar x = newComponentVNode(0, Composite, {\n  children: props.children\n});\nvar x = newComponentVNode(0, Composite, {\n  children: newComponentVNode(0, Composite2)\n});');
    });

    it('should-allow-nested-fragments', function () {
      expect(transform('<div>\n  <  >\n    <>\n      <span>Hello</span>\n      <span>world</span>\n    </>\n    <>\n      <span>Goodbye</span>\n      <span>world</span>\n    </>\n  </>\n</div>')).to.equal('newVNode(9, "div", null, newFragment(260, [newFragment(260, [newVNode(3, "span", null, "Hello"), newVNode(3, "span", null, "world")]), newFragment(260, [newVNode(3, "span", null, "Goodbye"), newVNode(3, "span", null, "world")])]));');
    });

    it('comments', function () {
      var code = transform('<div {.../*i18n*/{ id: "hello" }} />;\n<Trans /*test1 */a="1"/**test2 */b="2"/**test3 */ />;');

      expect(code).to.equal('normalizeProps(newVNode(17, "div", null, null, {\n  ... /*i18n*/{\n    id: "hello"\n  }\n}));\nnewComponentVNode(0, Trans, {\n  "a": "1",\n  "b": "2"\n});');
      expectValidJS(code);
    });
  });

  describe('babel-parser jsx fixtures', function () {
    it('basic/3', function () {
      expect(transform('<a n:foo="bar"> {value} <b><c /></b></a>')).to.equal('newVNode(1, "a", null, [newTextVNode(" "), value, newTextVNode(" "), newVNode(9, "b", null, newVNode(17, "c"))], {\n  "n:foo": "bar"\n});');
    });

    it('basic/6', function () {
      expect(transform('<日本語></日本語>')).to.equal('newComponentVNode(0, 日本語);');
    });

    it('basic/11', function () {
      expect(transform('<div>@test content</div>')).to.equal('newVNode(3, "div", null, "@test content");');
    });

    it('basic/12', function () {
      expect(transform('<div><br />7x invalid-js-identifier</div>')).to.equal('newVNode(5, "div", null, [newVNode(17, "br"), newTextVNode("7x invalid-js-identifier")]);');
    });

    it('basic/16', function () {
      expect(transform('(<div />) < x;')).to.equal('newVNode(17, "div") < x;');
    });

    it('basic/asi', function () {
      expect(transform('let x\n<div />')).to.equal('let x;\nnewVNode(17, "div");');
    });

    it('keyword-tag', function () {
      expect(transform('<var></var>')).to.equal('newVNode(17, "var");');
    });

    it('yield-tag', function () {
      expect(transform('function* g() { yield <a></a>; }')).to.equal('function* g() {\n  yield newVNode(17, "a");\n}');
    });

    it('entity', function () {
      expect(transform('<A>&#x1f4a9;</A>')).to.equal('newComponentVNode(0, A, {\n  children: "💩"\n});');
    });

    it('nonentity', function () {
      expect(transform('<A>&#x1g4q9;</A>')).to.equal('newComponentVNode(0, A, {\n  children: "&#x1g4q9;"\n});');
    });

    it('html-entities/code-point', function () {
      expect(transform('<div>&#1234;&#xABC;&#x10ffff;</div>')).to.equal('newVNode(3, "div", null, "Ӓ઼􏿿");');
    });

    it('html-entities/invalid', function () {
      expect(transform('<div>&amp &ampa; &amp ; &xamp; &#0_0;</div>')).to.equal('newVNode(3, "div", null, "&amp &ampa; &amp ; &xamp; &#0_0;");');
    });

    it('fragment-5', function () {
      expect(transform('<\n// comment1\n/* comment2 */\n><div/></>')).to.equal('newFragment(260, [newVNode(17, "div")]);');
    });

    it('fragment-6', function () {
      expect(transform('<><div>JSXElement</div>JSXText{"JSXExpressionContainer"}</>')).to.equal('newFragment(256, [newVNode(3, "div", null, "JSXElement"), newTextVNode("JSXText"), newTextVNode("JSXExpressionContainer")]);');
    });

    it('regression/1', function () {
      expect(transform('<p>foo <a href="test"> bar</a> baz</p>')).to.equal('newVNode(5, "p", null, [newTextVNode("foo "), newVNode(3, "a", null, " bar", {\n  "href": "test"\n}), newTextVNode(" baz")]);');
    });

    it('regression/4', function () {
      expect(transform('<div>/text</div>')).to.equal('newVNode(3, "div", null, "/text");');
    });

    it('regression/issue-2083', function () {
      expect(transform('true ? (<div />) : <div />')).to.equal('true ? newVNode(17, "div") : newVNode(17, "div");');
    });

    it('issue-8891', function () {
      expect(transform('<div prop={{ function: "test" }} />')).to.equal('newVNode(17, "div", null, null, {\n  "prop": {\n    function: "test"\n  }\n});');
    });

    it('issue-11387', function () {
      expect(transform('<div>{(this?.class, this.class, this?.function, this.function)}</div>')).to.equal('newVNode(1, "div", null, (this?.class, this.class, this?.function, this.function));');
    });

    it('tsx/assignment-in-conditional-expression', function () {
      expect(transform('a == 3 ? (a = <h1>123</h1>) : (a = <h1>abc</h1>)')).to.equal('a == 3 ? a = newVNode(3, "h1", null, "123") : a = newVNode(3, "h1", null, "abc");');
    });
  });

  describe('transform-react-constant-elements fixtures', function () {
    it('magical-bindings (super)', function () {
      expect(transform('class A extends B { m() { return <super.Foo/>; } }')).to.equal('class A extends B {\n  m() {\n    return newComponentVNode(0, super.Foo);\n  }\n}');
    });

    it('magical-bindings (new.target)', function () {
      expect(transform('function f() { return <new.target.Foo/>; }')).to.equal('function f() {\n  return newComponentVNode(0, new.target.Foo);\n}');
    });

    it('magical-bindings (arguments)', function () {
      expect(transform('function f() { return <arguments.Foo/>; }')).to.equal('function f() {\n  return newComponentVNode(0, arguments.Foo);\n}');
    });

    it('lowercase-member-expression (transform-react-inline-elements)', function () {
      expect(transform('<form.TestComponent />')).to.equal('newComponentVNode(0, form.TestComponent);');
    });
  });

  describe('TSX variants', function () {
    it('should-allow-js-namespacing with type arguments', function () {
      expect(stripInfernoImport(transformTSX('<Namespace.Component<string> />;'))).to.equal('newComponentVNode(0, Namespace.Component);');
    });

    it('should-allow-deeper-js-namespacing with type arguments', function () {
      expect(stripInfernoImport(transformTSX('<Namespace.DeepNamespace.Component<Props, State> value={1} />;'))).to.equal('newComponentVNode(0, Namespace.DeepNamespace.Component, {\n  "value": 1\n});');
    });

    it('this-tag-name with type arguments', function () {
      expect(stripInfernoImport(transformTSX('var div = <this.Foo<string>>test</this.Foo>;'))).to.equal('var div = newComponentVNode(0, this.Foo, {\n  children: "test"\n});');
    });

    it('assignment with a type assertion in the spread', function () {
      expect(stripInfernoImport(transformTSX('var div = <Component {...(props as Props)} foo="bar" />'))).to.equal('var div = normalizeProps(newComponentVNode(0, Component, {\n  ...props,\n  "foo": "bar"\n}));');
    });

    it('assignment with non-null and satisfies expressions', function () {
      expect(stripInfernoImport(transformTSX('var div = <Component {...props!} foo={bar satisfies string} />'))).to.equal('var div = normalizeProps(newComponentVNode(0, Component, {\n  ...props,\n  "foo": bar\n}));');
    });

    it('should-not-mangle-expressioncontainer-attribute-values with a type assertion', function () {
      expect(stripInfernoImport(transformTSX('<button data-value={"a value\\n  with\\nnewlines" as string}>Button</button>;'))).to.equal('newVNode(3, "button", null, "Button", {\n  "data-value": "a value\\n  with\\nnewlines"\n});');
    });

    it('Should compile a generic arrow function render prop', function () {
      expect(stripInfernoImport(transformTSX('<Foo render={<T,>(item: T) => <div>{item}</div>} />'))).to.equal('newComponentVNode(0, Foo, {\n  "render": item => newVNode(1, "div", null, item)\n});');
    });
  });

  describe('current behaviour (questionable)', function () {
    // Babel compiles <this /> to a this reference
    it('arrow-functions (compiles <this /> to an element)', function () {
      expect(transform('var foo = function () {\n  return () => <this />;\n};\n\nvar bar = function () {\n  return () => <this.foo />;\n};')).to.equal('var foo = function () {\n  return () => newVNode(17, "this");\n};\nvar bar = function () {\n  return () => newComponentVNode(0, this.foo);\n};');
    });
  });
});
