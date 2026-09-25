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

  // The JSX source text of attribute strings is reused (see known-bugs/attribute-strings), so quote style follows the source
  describe('current behaviour (questionable)', function () {
    it('Should keep single quotes of a single-quoted attribute string', function () {
      var code = transform('<div title=\'it"s\' />');

      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "title": \'it"s\'\n});');
      expectValidJS(code);
    });
  });
});
