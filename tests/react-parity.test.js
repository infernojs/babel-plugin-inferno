// Cases mirrored from React's JSX test suites. Titles name the React test they come from.
// - babel-plugin-react-jsx tests were deleted from React; read them with
//   git -C ~/git/react show a876808f0a^:packages/babel-plugin-react-jsx/__tests__/TransformJSXToReactJSX-test.js
// - jstransform tests: git -C ~/git/react show d2fe87892d^:vendor/fbtransform/transforms/__tests__/react-test.js
// - compiler fixtures: compiler/packages/babel-plugin-react-compiler/src/__tests__/fixtures/compiler/
// - runtime tests: packages/react/src/__tests__/ and packages/react-dom/src/__tests__/

var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var expectValidJS = helpers.expectValidJS;

describe('React parity', function () {
  describe('TransformJSXToReactJSX-test', function () {
    it('Should keep a trailing space before an expression (should handle attributed elements)', function () {
      expect(transform('<div>Hello {this.props.name}</div>')).to.equal('createVNode(1, "div", null, [createTextVNode("Hello "), this.props.name], 0);');
    });

    it('Should compile an element inside a multi-line attribute expression', function () {
      expect(transform('<HelloMessage name={\n  <span>\n    Sebastian\n  </span>\n} />')).to.equal('createComponentVNode(2, HelloMessage, {\n  "name": createVNode(1, "span", null, "Sebastian", 16)\n});');
    });

    it('Should not strip &nbsp; followed by a space', function () {
      expect(transform('<div>&nbsp; </div>')).to.equal('createVNode(1, "div", null, "\\xA0 ", 16);');
    });

    it('Should keep &nbsp; between words', function () {
      expect(transform('<div>w &nbsp; w</div>')).to.equal('createVNode(1, "div", null, "w \\xA0 w", 16);');
    });

    it('Should keep a bare ampersand', function () {
      expect(transform('<div>w & w</div>')).to.equal('createVNode(1, "div", null, "w & w", 16);');
    });

    it('Should decode &amp; and &lt; in text', function () {
      expect(transform('<div>w &amp; w</div>;\n<div>w &lt; w</div>')).to.equal('createVNode(1, "div", null, "w & w", 16);\ncreateVNode(1, "div", null, "w < w", 16);');
    });

    it('Should keep non-ASCII text', function () {
      expect(transform('<div>wôw</div>')).to.equal('createVNode(1, "div", null, "wôw", 16);');
    });

    it('Should compile a keyed React.Fragment without children', function () {
      expect(transform('<React.Fragment key="foo"></React.Fragment>')).to.equal('createFragment(null, 1, "foo");');
    });

    it('Should compile a spread of a null variable', function () {
      expect(transform('var foo = null;\n<div {...foo} />')).to.equal('var foo = null;\nnormalizeProps(createVNode(1, "div", null, null, 1, {\n  ...foo\n}));');
    });

    it('Should compile a spread followed by a prop', function () {
      expect(transform('<Component {...props} sound="moo" />')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  ...props,\n  "sound": "moo"\n}));');
    });

    it('Should drop a children prop that is overridden by a spread and JSX children', function () {
      expect(transform('<Component children={1} {...x}>2</Component>')).to.equal('normalizeProps(createComponentVNode(2, Component, {\n  ...x,\n  children: "2"\n}));');
    });

    it('Should compile a mixed static element and array child', function () {
      expect(transform('<div><span />{[<span key="0" />, <span key="1" />]}</div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "span"), [createVNode(1, "span", null, null, 1, null, "0"), createVNode(1, "span", null, null, 1, null, "1")]], 0);');
    });

    it('Should compile a single array child', function () {
      expect(transform('<div>{[<span key="0" />, <span key="1" />]}</div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "span", null, null, 1, null, "0"), createVNode(1, "span", null, null, 1, null, "1")], 0);');
    });
  });

  describe('jstransform react-test', function () {
    it('Should keep parenthesized attribute values', function () {
      expect(transform('<foo a={(b)} c={(d)}>Hello</foo>')).to.equal('createVNode(1, "foo", null, "Hello", 16, {\n  "a": b,\n  "c": d\n});');
    });

    it('Should allow constructor as a component prop', function () {
      expect(transform('<Component constructor="foo" />')).to.equal('createComponentVNode(2, Component, {\n  "constructor": "foo"\n});');
    });

    it('Should keep comments inside a parenthesized child expression', function () {
      var code = transform('<div>\n  Foo {(e+f //A line comment\n  /* A multiline comment */)\n  } bar\n</div>');

      expect(code).to.equal('createVNode(1, "div", null, [createTextVNode("Foo "), e + f //A line comment\n/* A multiline comment */, createTextVNode(" bar")], 0);');
      expectValidJS(code);
    });

    it('Should keep leading spaces of the first text line', function () {
      expect(transform('<div>  sdfsdfsdf\n  sdlkfjsdfljs\n   </div>')).to.equal('createVNode(1, "div", null, "  sdfsdfsdf sdlkfjsdfljs", 16);');
    });

    it('Should convert trailing tabs to spaces', function () {
      expect(transform('<div>a  \t \t </div>')).to.equal('createVNode(1, "div", null, "a      ", 16);');
    });

    it('Should keep a leading space', function () {
      expect(transform('<div> a</div>')).to.equal('createVNode(1, "div", null, " a", 16);');
    });

    it('Should keep a trailing space', function () {
      expect(transform('<div>a </div>')).to.equal('createVNode(1, "div", null, "a ", 16);');
    });
  });

  describe('compiler fixtures', function () {
    it('Should keep JSX text and a string literal child apart (preserve-jsxtext-stringliteral-distinction)', function () {
      expect(transform('<div> {", "}</div>')).to.equal('createVNode(1, "div", null, [createTextVNode(" "), createTextVNode(", ")], 0);');
    });

    it('Should compile nested member expression tags (jsx-member-expression)', function () {
      expect(transform('<Sathya.Codes.Forget><Foo.Bar.Baz /></Sathya.Codes.Forget>')).to.equal('createComponentVNode(2, Sathya.Codes.Forget, {\n  children: createComponentVNode(2, Foo.Bar.Baz)\n});');
    });

    it('Should compile a lowercase local member expression as a component (jsx-lowercase-localvar-memberexpr)', function () {
      expect(transform('<localVar.Stringify>hello world {name}</localVar.Stringify>')).to.equal('createComponentVNode(2, localVar.Stringify, {\n  children: ["hello world ", name]\n});');
    });

    it('Should keep a lowercase tag a string even with a same-named binding (invalid-jsx-lowercase-localvar)', function () {
      expect(transform('const invalidTag = Throw;\n<invalidTag val={{val: 2}} />;')).to.equal('const invalidTag = Throw;\ncreateVNode(1, "invalidTag", null, null, 1, {\n  "val": {\n    val: 2\n  }\n});');
    });

    it('Should compile a valueless attribute to true (jsx-attribute-default-to-true)', function () {
      expect(transform('<Stringify truthyAttribute />')).to.equal('createComponentVNode(2, Stringify, {\n  "truthyAttribute": true\n});');
    });

    it('Should decode entities in text (jsx-html-entity)', function () {
      expect(transform('<div>&gt;&lt;span &amp;</div>')).to.equal('createVNode(1, "div", null, "><span &", 16);');
    });

    it('Should decode numeric entities across a line break (jsx-bracket-in-text)', function () {
      expect(transform('<div>If the string contains the string &#123;pageNumber&#125; it will be\n    replaced</div>')).to.equal('createVNode(1, "div", null, "If the string contains the string {pageNumber} it will be replaced", 16);');
    });

    it('Should keep escapes of strings in expression containers (jsx-string-attribute-expression-container)', function () {
      expect(transform('<Foo value={\'\\n\'} other={\'A\\tE\'} />')).to.equal('createComponentVNode(2, Foo, {\n  "value": \'\\n\',\n  "other": \'A\\tE\'\n});');
    });

    it('Should keep lone surrogates in expression containers (lone-surrogate-string-values)', function () {
      expect(transform('<Foo codepoints={[\'\\uD83E\', \'\\uDD21\']} />')).to.equal('createComponentVNode(2, Foo, {\n  "codepoints": [\'\\uD83E\', \'\\uDD21\']\n});');
    });

    it('Should keep key and style after a spread (repro-undefined-expression-of-jsxexpressioncontainer)', function () {
      expect(transform('<Stringify {...buttonProps} key={`button-${i}`} style={s} />')).to.equal('normalizeProps(createComponentVNode(2, Stringify, {\n  ...buttonProps,\n  "style": s\n}, `button-${i}`));');
    });
  });

  describe('react-dom and runtime tests', function () {
    it('Should keep explicit space children (ReactDOMServerIntegrationElements)', function () {
      expect(transform('<div>{" "}{" "}{" "}</div>')).to.equal('createVNode(1, "div", null, [" ", " ", " "], 0);');
    });

    it('Should keep a space between two expressions in an option (ReactDOMOption)', function () {
      expect(transform('<option>\n  {1} {"foo"}\n</option>')).to.equal('createVNode(1, "option", null, [1, createTextVNode(" "), createTextVNode("foo")], 0);');
    });

    it('Should split text around an expression in an option (ReactDOMOption)', function () {
      expect(transform('<option>gir{a}ffe</option>')).to.equal('createVNode(1, "option", null, [createTextVNode("gir"), a, createTextVNode("ffe")], 0);');
    });

    it('Should keep text directly next to an element (ReactDOMServerIntegrationElements)', function () {
      expect(transform('<div>\n  Text<span>More Text</span>\n</div>')).to.equal('createVNode(1, "div", null, [createTextVNode("Text"), createVNode(1, "span", null, "More Text", 16)], 4);');
    });

    it('Should compile deeply nested fragments with null and false (ReactDOMServerIntegrationFragment)', function () {
      expect(transform('<><><div>text1</div></><span/><><><>{null}<p /></>{false}</></></>')).to.equal('createFragment([createFragment([createVNode(1, "div", null, "text1", 16)], 4), createVNode(1, "span"), createFragment([createFragment([createFragment([null, createVNode(1, "p")], 0), false], 0)], 4)], 4);');
    });

    it('Should pass expression children of a textarea (ReactDOMTextarea)', function () {
      expect(transform('<textarea>{17}</textarea>')).to.equal('createVNode(128, "textarea", null, 17, 0);');
    });

    it('Should keep select props (ReactDOMSelect)', function () {
      expect(transform('<select multiple={true} defaultValue={["giraffe"]} />')).to.equal('createVNode(256, "select", null, null, 1, {\n  "multiple": true,\n  "defaultValue": ["giraffe"]\n});');
    });

    it('Should pass __source and __self as ordinary props (ReactElementValidator)', function () {
      expect(transform('<div __source={{fileName: "a"}} __self={this} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "__source": {\n    fileName: "a"\n  },\n  "__self": this\n});');
    });

    it('Should keep a whitespace-only line between inline elements (whitespace transformer README)', function () {
      expect(transform('<div>\n  Monkeys:\n  <input type="text" /> <button />\n</div>')).to.equal('createVNode(1, "div", null, [createTextVNode("Monkeys:"), createVNode(64, "input", null, null, 1, {\n  "type": "text"\n}), createTextVNode(" "), createVNode(1, "button")], 4);');
    });
  });

  describe('current behaviour (questionable)', function () {
    // The quotes change once known-bugs/attribute-strings is fixed
    it('Should keep the single quotes of a single-quoted attribute (quoted-strings-in-jsx-attribute)', function () {
      expect(transform('<Stringify text=\'Some "text"\' />')).to.equal('createComponentVNode(2, Stringify, {\n  "text": \'Some "text"\'\n});');
    });

    // React drops the comments entirely: the span gets no children and the div two static children
    it('Should keep empty spans and UnknownChildren when comments sit between children (TransformJSXToReactJSX-test)', function () {
      expect(transform('<div>\n  {/* A comment at the beginning */}\n  {/* A second comment at the beginning */}\n  <span>\n    {/* A nested comment */}\n  </span>\n  {/* A sandwiched comment */}\n  <br />\n  {/* A comment at the end */}\n  {/* A second comment at the end */}\n</div>')).to.equal('createVNode(1, "div", null, [createVNode(1, "span", null, null, 0), createVNode(1, "br")], 0);');
    });
  });
});
