var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var expectValidJS = helpers.expectValidJS;

describe('Entities and strings', function () {
  describe('entities in text', function () {
    it('Should decode &nbsp;', function () {
      var code = transform('<div>&nbsp;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "\\xA0", 16);');
      expectValidJS(code);
    });

    it('Should decode &amp; &lt; &gt; &quot;', function () {
      var code = transform('<div>&amp;&lt;&gt;&quot;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "&<>\\"", 16);');
      expectValidJS(code);
    });

    it('Should decode decimal numeric entities', function () {
      var code = transform('<div>&#123;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "{", 16);');
      expectValidJS(code);
    });

    it('Should decode hexadecimal numeric entities', function () {
      var code = transform('<div>&#x20;a</div>');

      expect(code).to.equal('createVNode(1, "div", null, " a", 16);');
      expectValidJS(code);
    });

    it('Should decode &#0000; to a NUL character', function () {
      var code = transform('<div>&#0000;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "\\0", 16);');
      expectValidJS(code);
    });

    it('Should keep unknown entities verbatim', function () {
      var code = transform('<div>&nosuch;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "&nosuch;", 16);');
      expectValidJS(code);
    });

    it('Should keep entity-like text verbatim', function () {
      var code = transform('<div>&ampr;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "&ampr;", 16);');
      expectValidJS(code);
    });

    it('Should not resolve Object.prototype names as entities', function () {
      var code = transform('<div>&valueOf;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "&valueOf;", 16);');
      expectValidJS(code);
    });

    it('Should keep entities without a terminating semicolon verbatim', function () {
      var code = transform('<div>&Egrave &#123 &#x123</div>');

      expect(code).to.equal('createVNode(1, "div", null, "&Egrave &#123 &#x123", 16);');
      expectValidJS(code);
    });
  });

  describe('unicode text', function () {
    it('Should keep emoji and accented characters', function () {
      var code = transform('<div>😀 ünïcödé</div>');

      expect(code).to.equal('createVNode(1, "div", null, "😀 ünïcödé", 16);');
      expectValidJS(code);
    });

    it('Should keep CJK text', function () {
      var code = transform('<div>日本語</div>');

      expect(code).to.equal('createVNode(1, "div", null, "日本語", 16);');
      expectValidJS(code);
    });
  });

  describe('backslashes in text', function () {
    it('Should keep backslashes in text literal', function () {
      var code = transform('<div>C:\\temp\\new</div>');

      expect(code).to.equal('createVNode(1, "div", null, "C:\\\\temp\\\\new", 16);');
      expectValidJS(code);
    });

    it('Should not parse \\u escapes in text', function () {
      var code = transform('<div>this should not parse as unicode: \\u00a0</div>');

      expect(code).to.equal('createVNode(1, "div", null, "this should not parse as unicode: \\\\u00a0", 16);');
      expectValidJS(code);
    });
  });

  describe('string attribute values', function () {
    it('Should keep a plain attribute string', function () {
      var code = transform('<div title="plain" />');

      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": "plain"\n});');
      expectValidJS(code);
    });

    it('Should keep an empty attribute string', function () {
      var code = transform('<div title="" />');

      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": ""\n});');
      expectValidJS(code);
    });

    it('Should keep non-ASCII characters in attribute strings', function () {
      var code = transform('<div title="ünïcödé 😀" />');

      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": "ünïcödé 😀"\n});');
      expectValidJS(code);
    });

    it('Should print a single-quoted attribute string with double quotes', function () {
      var code = transform('<div title=\'it"s\' />');

      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": "it\\"s"\n});');
      expectValidJS(code);
    });
  });

  describe('attribute strings with line breaks', function () {
    it('Should compile a multi-line className', function () {
      var code = transform('<div className="flex\n    items-center\n    gap-2">x</div>');

      expectValidJS(code);
      expect(code).to.equal('createVNode(1, "div", "flex items-center gap-2", "x", 16);');
    });

    it('Should compile a multi-line svg path (babel-parser regression/7)', function () {
      var code = transform('<path d="M230 80\n\t\tA 45 45, 0, 1, 0, 275 125\n    L 275 80 Z"/>');

      expectValidJS(code);
      expect(code).to.equal('createVNode(32, "path", null, null, 1, {\n  "d": "M230 80 A 45 45, 0, 1, 0, 275 125 L 275 80 Z"\n});');
    });

    it('Should compile a multi-line prop on an element', function () {
      var code = transform('<div title="a\n   b" />');

      expectValidJS(code);
      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": "a b"\n});');
    });

    it('Should compile a multi-line prop on a component (transform-react-inline-elements regressions/6276)', function () {
      var code = transform('<T default="\n    some string\n  " />');

      expectValidJS(code);
      expect(code).to.equal('createComponentVNode(2, T, {\n  "default": " some string "\n});');
    });

    it('Should compile a line break that is not followed by whitespace', function () {
      var code = transform('<div title="a\nb" />');

      expectValidJS(code);
      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": "a\\nb"\n});');
    });

    it('Should compile a multi-line key', function () {
      expectValidJS(transform('<div key="line1\n  line2" />'));
    });

    it('Should compile an attribute with a CRLF line break', function () {
      expectValidJS(transform('<div a="x\r\n   y" />'));
    });
  });

  describe('attribute strings with backslashes', function () {
    it('Should compile a value ending in a backslash', function () {
      var code = transform(String.raw`<div title="\" />`);

      expectValidJS(code);
      expect(code).to.equal(String.raw`createVNode(1, "div", null, null, 1, {
  "title": "\\"
});`);
    });

    it('Should keep regular expression escapes in pattern', function () {
      expect(transform(String.raw`<input pattern="\d{3}" />`)).to.equal(String.raw`createVNode(64, "input", null, null, 1, {
  "pattern": "\\d{3}"
});`);
    });

    it('Should keep a complex pattern (babel-parser regression/issue-2114)', function () {
      expect(transform(String.raw`<input pattern="^([\w\.\-]+\s)*[\w\.\-]+\s?$" />`)).to.equal(String.raw`createVNode(64, "input", null, null, 1, {
  "pattern": "^([\\w\\.\\-]+\\s)*[\\w\\.\\-]+\\s?$"
});`);
    });

    it('Should keep a backslash in a key (babel should-escape-xhtml-jsxattribute)', function () {
      expect(transform(String.raw`<div key="\w" />`)).to.equal(String.raw`createVNode(1, "div", null, null, 1, null, "\\w");`);
    });

    it('Should keep backslashes before quotes (react compiler quoted-strings-in-jsx-attribute-escaped)', function () {
      expect(transform(String.raw`<Stringify text='Some \"text\"' />`)).to.equal(String.raw`createComponentVNode(2, Stringify, {
  "text": "Some \\\"text\\\""
});`);
    });

    it('Should produce valid module code for \\9 (oxc jsx-attribute-legacy-escapes)', function () {
      var code = transform(String.raw`<Component mask="+4\9 99 999 99" />`);

      expectValidJS(code);
      expect(code).to.equal(String.raw`createComponentVNode(2, Component, {
  "mask": "+4\\9 99 999 99"
});`);
    });

    it('Should keep \\0 as a backslash and a zero', function () {
      expect(transform(String.raw`<div re="\0" />`)).to.equal(String.raw`createVNode(1, "div", null, null, 1, {
  "re": "\\0"
});`);
    });

    it('Should keep \\n as a backslash and an n', function () {
      expect(transform(String.raw`<div title="\n" />`)).to.equal(String.raw`createVNode(1, "div", null, null, 1, {
  "title": "\\n"
});`);
    });
  });

  describe('attribute strings with entities', function () {
    it('Should decode entities in element props', function () {
      expect(transform('<div title="a&amp;b" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": "a&b"\n});');
    });

    it('Should decode entities in component props', function () {
      expect(transform('<Foo title="a&amp;b" />')).to.equal('createComponentVNode(2, Foo, {\n  "title": "a&b"\n});');
    });

    it('Should decode entities in className', function () {
      expect(transform('<div className="a &amp; b" />')).to.equal('createVNode(1, "div", "a & b");');
    });

    it('Should decode quote entities in class', function () {
      expect(transform('<div class="&quot;q&quot;" />')).to.equal('createVNode(1, "div", "\\"q\\"");');
    });

    it('Should decode entities in key', function () {
      expect(transform('<div key="a&amp;b" />')).to.equal('createVNode(1, "div", null, null, 1, null, "a&b");');
    });

    it('Should decode named entities (oxc attribute-escapes)', function () {
      expect(transform('<Foo bar="&Egrave; &euro; &quot;" />')).to.equal('createComponentVNode(2, Foo, {\n  "bar": "È € \\""\n});');
    });

    it('Should decode numeric entities (oxc attribute-escapes)', function () {
      expect(transform('<Foo bar="&#xC; &#x41;" />')).to.equal('createComponentVNode(2, Foo, {\n  "bar": "\\f A"\n});');
    });

    it('Should decode &amp; and keep unknown entities (babel-parser basic/4)', function () {
      expect(transform('<a d="&amp;" e="&ampr;" />')).to.equal('createVNode(1, "a", null, null, 1, {\n  "d": "&",\n  "e": "&ampr;"\n});');
    });
  });

  describe('children prop strings', function () {
    it('Should decode entities in an element children prop string', function () {
      var code = transform('<div children="a&amp;b" />');

      expect(code).to.equal('createVNode(1, "div", null, "a&b", 16);');
      expectValidJS(code);
    });

    it('Should keep a whitespace-only element children prop string', function () {
      expect(transform('<div children="   " />')).to.equal('createVNode(1, "div", null, "   ", 16);');
    });

    it('Should create no children for an empty element children prop string', function () {
      expect(transform('<div children="" />')).to.equal('createVNode(1, "div");');
    });
  });
});
