// Cases mirrored from oxc's transformer conformance fixtures. Titles name the fixture they come from.
// - ~/git/oxc/tasks/transform_conformance/tests/babel-plugin-transform-react-jsx/test/fixtures/
// - ~/git/oxc/tasks/transform_conformance/tests/babel-plugin-transform-typescript/test/fixtures/jsx/
// - ~/git/oxc/tasks/transform_conformance/tests/babel-plugin-transform-arrow-functions/test/fixtures/

var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformWith = helpers.transformWith;
var transformTSX = helpers.transformTSX;
var expectValidJS = helpers.expectValidJS;
var es5 = helpers.es5;

describe('oxc parity', function () {
  describe('text/escapes', function () {
    it('Should decode named entities', function () {
      var code = transform('<div>&nbsp;&iexcl;&cent;&pound;&curren;&yen;&brvbar;&sect;&uml;&copy;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "\\xA0¡¢£¤¥¦§¨©", 16);');
      expectValidJS(code);
    });

    it('Should decode invisible named entities', function () {
      var code = transform('<div>&shy; &ensp; &emsp; &thinsp; &zwnj; &zwj; &lrm; &rlm;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "\u00AD \\u2002 \\u2003 \\u2009 \u200C \u200D \u200E \u200F", 16);');
      expectValidJS(code);
    });

    it('Should decode quote, ampersand and angle entities and keep unknown ones', function () {
      var code = transform('<div>&quot; &amp; &lt; &gt; &donkey;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "\\" & < > &donkey;", 16);');
      expectValidJS(code);
    });

    it('Should decode accented and currency entities', function () {
      var code = transform('<div>&Egrave; &euro;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "È €", 16);');
      expectValidJS(code);
    });
  });

  describe('text/numeric-escapes', function () {
    it('Should decode hexadecimal entities up to U+10FFFF', function () {
      var code = transform('<div>&#xC; &#x41; &#x123; &#x1234; &#x10000; &#x10FFFF;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "\\f A ģ ሴ 𐀀 􏿿", 16);');
      expectValidJS(code);
    });

    it('Should decode decimal entities up to U+10FFFF', function () {
      var code = transform('<div>&#12; &#65; &#291; &#4660; &#65536; &#1114111;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "\\f A ģ ሴ 𐀀 􏿿", 16);');
      expectValidJS(code);
    });

    it('Should keep invalid numeric entities verbatim', function () {
      var code = transform('<div>&#xG; &#C;</div>');

      expect(code).to.equal('createVNode(1, "div", null, "&#xG; &#C;", 16);');
      expectValidJS(code);
    });
  });

  describe('text/unterminated-escapes', function () {
    it('Should keep a named entity without semicolon', function () {
      expect(transform('<div>&Egrave</div>')).to.equal('createVNode(1, "div", null, "&Egrave", 16);');
    });

    it('Should keep a named entity followed by text', function () {
      expect(transform('<div>&euro xxx</div>')).to.equal('createVNode(1, "div", null, "&euro xxx", 16);');
    });

    it('Should keep a decimal entity without semicolon', function () {
      expect(transform('<div>&#123 xxx</div>')).to.equal('createVNode(1, "div", null, "&#123 xxx", 16);');
    });

    it('Should keep a hexadecimal entity without semicolon', function () {
      expect(transform('<div>&#x123 xxx</div>')).to.equal('createVNode(1, "div", null, "&#x123 xxx", 16);');
    });
  });

  // Each whitespace run below is space, tab, space. Tabs become spaces like in Babel; oxc keeps them
  describe('text/whitespace', function () {
    it('Should keep single-line whitespace', function () {
      expect(transform('<div> \t angry \t </div>')).to.equal('createVNode(1, "div", null, "   angry   ", 16);');
    });

    it('Should keep whitespace of the first and last lines', function () {
      expect(transform('<div> \t boris\ncod\ndante \t </div>')).to.equal('createVNode(1, "div", null, "   boris cod dante   ", 16);');
    });

    it('Should drop whitespace-only first and last lines', function () {
      expect(transform('<div> \t \naging\n \t </div>')).to.equal('createVNode(1, "div", null, "aging", 16);');
    });

    it('Should keep whitespace inside a line', function () {
      expect(transform('<div>\n \t bark \t club \t devil \t \n</div>')).to.equal('createVNode(1, "div", null, "bark   club   devil", 16);');
    });
  });

  // Babel decodes entities before trimming, so an encoded newline collapses like a real one; oxc keeps it
  describe('text/newline-entities', function () {
    it('Should collapse an encoded newline between words', function () {
      expect(transform('<div>a&#10;b</div>')).to.equal('createVNode(1, "div", null, "a b", 16);');
    });

    it('Should collapse an encoded newline at a line end', function () {
      expect(transform('<div>\n  a&#10;\n  b\n</div>')).to.equal('createVNode(1, "div", null, "a b", 16);');
    });

    it('Should convert encoded tabs to spaces', function () {
      expect(transform('<div>&#9;x&#9;</div>')).to.equal('createVNode(1, "div", null, " x ", 16);');
    });
  });

  describe('text/unicode', function () {
    it('Should keep an emoji with a variation selector on its own line', function () {
      var code = transform('<h2>\n🏝\uFE0F\n</h2>');

      expect(code).to.equal('createVNode(1, "h2", null, "🏝\uFE0F", 16);');
      expectValidJS(code);
    });
  });

  describe('issues', function () {
    it('issue-6638: Should drop tab indentation of nested components', function () {
      expect(transform('<Suspense fallback={"Loading..."}>\n\t<PanelGroup>\n\t\t<Panel>\n\t\t\t<A/>\n\t\t</Panel>\n\t</PanelGroup>\n</Suspense>')).to.equal('createComponentVNode(2, Suspense, {\n  "fallback": "Loading...",\n  children: createComponentVNode(2, PanelGroup, {\n    children: createComponentVNode(2, Panel, {\n      children: createComponentVNode(2, A)\n    })\n  })\n});');
    });

    it('issue-20669: Should ignore @jsxImportSource pragmas in comments', function () {
      expect(transformWith({imports: true}, '/** @jsxImportSource react */\n/**\n * Mentions `@jsxImportSource custom/source` in docs\n */\nexport const a = <div/>;')).to.equal('import { createVNode } from "inferno";\n/** @jsxImportSource react */\n/**\n * Mentions `@jsxImportSource custom/source` in docs\n */\nexport const a = createVNode(1, "div");');
    });

    it('issue-10956: Should ignore @jsx and @jsxRuntime pragmas with onlyRemoveTypeImports', function () {
      expect(transformTSX('/** @jsx h */\n/** @jsxRuntime classic */\nexport const foo = <div/>;', {imports: true}, {onlyRemoveTypeImports: true})).to.equal('import { createVNode } from "inferno";\n/** @jsx h */\n/** @jsxRuntime classic */\nexport const foo = createVNode(1, "div");');
    });
  });

  describe('transform-arrow-functions/with-this-member-expression', function () {
    it('Should rewrite this in member tags inside arrow functions', function () {
      var code = transformWith({imports: true}, 'const f = function () {\n  return () => <this.foo.bar.qux />;\n};', es5);

      expect(code).to.contain('var _this = this;');
      expect(code).to.contain('return createComponentVNode(2, _this.foo.bar.qux);');
    });
  });

  describe('current behaviour (questionable)', function () {
    // oxc drops the comment, leaving a single static child
    it('static-children: Should mark a comment and an element as UnknownChildren', function () {
      expect(transform('<div>{ /* comment only */ }<span/></div>')).to.equal('createVNode(1, "div", null, createVNode(1, "span"), 0);');
    });
  });
});
