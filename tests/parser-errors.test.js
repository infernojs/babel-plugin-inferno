var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;

// These come from @babel/parser before the plugin runs; they pin the messages users see
describe('Parser errors', function () {
  it('Should reject adjacent root elements', function () {
    expect(function () {
      transform('var x = <div>one</div><div>two</div>;');
    }).to.throw('Adjacent JSX elements must be wrapped in an enclosing tag');
  });

  it('Should reject > in JSX text', function () {
    expect(function () {
      transform('<div>></div>');
    }).to.throw('Unexpected token `>`. Did you mean `&gt;` or `{\'>\'}`?');
  });

  it('Should reject } in JSX text', function () {
    expect(function () {
      transform('<div>}</div>');
    }).to.throw('Unexpected token `}`. Did you mean `&rbrace;` or `{\'}\'}`?');
  });

  it('Should reject mismatched closing tags', function () {
    expect(function () {
      transform('<Foo></Bar>');
    }).to.throw('Expected corresponding JSX closing tag for <Foo>');
  });

  it('Should reject a fragment closed by an element tag', function () {
    expect(function () {
      transform('<></something>');
    }).to.throw('Expected corresponding JSX closing tag for <>');
  });

  it('Should reject a namespace inside a member expression', function () {
    expect(function () {
      transform('<a.b:c />');
    }).to.throw('Unexpected token');
  });

  it('Should reject an unparenthesized sequence expression', function () {
    expect(function () {
      transform('<div a={b, c} />');
    }).to.throw('Sequence expressions cannot be directly nested inside JSX');
  });

  it('Should reject an unquoted call as attribute value', function () {
    expect(function () {
      transform('<Foo bar=bar() />');
    }).to.throw('JSX value should be either an expression or a quoted JSX text');
  });

  it('Should reject unterminated JSX contents', function () {
    expect(function () {
      transform('<foo>yes');
    }).to.throw('Unterminated JSX contents');
  });

  it('Should reject attributes on a short syntax fragment', function () {
    expect(function () {
      transform('< key="nope"></>');
    }).to.throw('Unexpected token');
  });
});
