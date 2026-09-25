var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('Whitespace and text', function () {
  describe('multi-line text', function () {
    it('Should join multi-line text with a single space', function () {
      expect(transform('<div>\n  hello\n  world\n</div>')).to.equal('createVNode(1, "div", null, "hello world", 16);');
    });

    it('Should drop blank lines inside multi-line text', function () {
      expect(transform('<div>\n  a\n\n  b\n</div>')).to.equal('createVNode(1, "div", null, "a b", 16);');
    });

    it('Should drop whitespace-only first and last lines', function () {
      expect(transform('<div>  \n  a  \n  </div>')).to.equal('createVNode(1, "div", null, "a", 16);');
    });

    it('Should drop a trailing whitespace-only line after text', function () {
      expect(transform('<div>a  \n  </div>')).to.equal('createVNode(1, "div", null, "a", 16);');
    });

    it('Should keep trailing spaces of the last line', function () {
      expect(transform('<div>\n  a\n  b  </div>')).to.equal('createVNode(1, "div", null, "a b  ", 16);');
    });

    it('Should convert tabs to spaces and trim tab indentation', function () {
      expect(transform('<div>\n\t\ta\n\t\tb\n</div>')).to.equal('createVNode(1, "div", null, "a b", 16);');
    });

    it('Should treat \\r\\n as a line break', function () {
      expect(transform('<div>a\r\nb</div>')).to.equal('createVNode(1, "div", null, "a b", 16);');
    });

    it('Should treat a lone \\r as a line break', function () {
      expect(transform('<div>a\rb</div>')).to.equal('createVNode(1, "div", null, "a b", 16);');
    });

    it('Should remove whitespace-only multi-line children of an element', function () {
      expect(transform('<div>\n\n</div>')).to.equal('createVNode(1, "div");');
    });
  });

  describe('single-line text', function () {
    it('Should keep leading and trailing spaces of single-line text', function () {
      expect(transform('<div>  hello  </div>')).to.equal('createVNode(1, "div", null, "  hello  ", 16);');
    });

    it('Should convert tabs inside single-line text to spaces', function () {
      expect(transform('<div>\ta\tb\t</div>')).to.equal('createVNode(1, "div", null, " a b ", 16);');
    });

    it('Should keep a single space between two expressions', function () {
      expect(transform('<div>{a} {b}</div>')).to.equal('createVNode(1, "div", null, [a, createTextVNode(" "), b], 0);');
    });

    it('Should keep spaces around a single expression on one line', function () {
      expect(transform('<div>  {a}  </div>')).to.equal('createVNode(1, "div", null, [createTextVNode("  "), a, createTextVNode("  ")], 0);');
    });

    it('Should drop a line break between two expressions', function () {
      expect(transform('<div>{a}\n{b}</div>')).to.equal('createVNode(1, "div", null, [a, b], 0);');
    });

    it('Should drop indentation between expressions', function () {
      expect(transform('<div>\n  {a}\n  {b}\n</div>')).to.equal('createVNode(1, "div", null, [a, b], 0);');
    });

    it('Should keep a single space between two expressions with type assertions', function () {
      expect(stripInfernoImport(transformTSX('<div>{a as string} {b!}</div>'))).to.equal('createVNode(1, "div", null, [a, createTextVNode(" "), b], 0);');
    });
  });

  describe('text next to expressions', function () {
    it('Should keep the space between text and an expression on the same line', function () {
      expect(transform('<div>\n  foo {bar}\n</div>')).to.equal('createVNode(1, "div", null, [createTextVNode("foo "), bar], 0);');
    });

    it('Should split text lines separated by an expression line', function () {
      expect(transform('<div>\n  foo\n  {bar}\n  baz\n</div>')).to.equal('createVNode(1, "div", null, [createTextVNode("foo"), bar, createTextVNode("baz")], 0);');
    });

    it('Should keep an explicit {" "} child', function () {
      expect(transform('<div>{a}{" "}{b}</div>')).to.equal('createVNode(1, "div", null, [a, " ", b], 0);');
    });
  });

  describe('whitespace-only children', function () {
    it('Should pass single-line whitespace as component children', function () {
      expect(transform('<Foo>  </Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: "  "\n});');
    });

    it('Should drop indentation around a single component child', function () {
      expect(transform('<Foo>\n  <div/>\n</Foo>')).to.equal('createComponentVNode(2, Foo, {\n  children: createVNode(1, "div")\n});');
    });

    it('Should create no children for a component with only a line break', function () {
      expect(transform('<Baz>\n</Baz>')).to.equal('createComponentVNode(2, Baz);');
    });

    it('Should create an empty fragment when it only contains whitespace lines', function () {
      expect(transform('<>\n  \n</>')).to.equal('createFragment();');
    });

    it('Should keep single-line whitespace inside a long syntax Fragment', function () {
      expect(transform('<Fragment>  </Fragment>')).to.equal('createFragment([createTextVNode("  ")], 4);');
    });

    it('Should pass single-line whitespace as children of a component with type arguments', function () {
      expect(stripInfernoImport(transformTSX('<Foo<Props>>  </Foo>'))).to.equal('createComponentVNode(2, Foo, {\n  children: "  "\n});');
    });
  });

  describe('non-breaking spaces', function () {
    it('Should not trim &nbsp; on its own line', function () {
      expect(transform('<div>\n  &nbsp;\n</div>')).to.equal('createVNode(1, "div", null, "\\xA0", 16);');
    });

    it('Should keep literal non-breaking spaces', function () {
      expect(transform('<div>\u00A0 \u00A0</div>')).to.equal('createVNode(1, "div", null, "\\xA0 \\xA0", 16);');
    });

    it('Should only trim spaces and tabs, not literal non-breaking spaces', function () {
      expect(transform('<div>\n  \u00A0a\u00A0\n</div>')).to.equal('createVNode(1, "div", null, "\\xA0a\\xA0", 16);');
    });
  });
});
