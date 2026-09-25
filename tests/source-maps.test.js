// Generated calls keep the location of the JSX they replace, so source maps point at the JSX
var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var babelTransform = helpers.babelTransform;
var originalPosition = helpers.originalPosition;

describe('Source maps', function () {
  var input = [
    'const x = 1;',
    '',
    'const el = (',
    '  <div className="a">',
    '    <Foo bar={x} />',
    '    text',
    '  </div>',
    ');',
    'const f = (',
    '  <>',
    '    <b {...p} />',
    '  </>',
    ');'
  ].join('\n');

  function compile() {
    return babelTransform({imports: true}, input, {sourceMaps: true, filename: 'input.jsx'});
  }

  it('Should map an element call to its opening tag', function () {
    expect(originalPosition(compile(), 'createVNode(1, "div"')).to.deep.equal({line: 4, column: 2});
  });

  it('Should map a component call to its opening tag', function () {
    expect(originalPosition(compile(), 'createComponentVNode(2')).to.deep.equal({line: 5, column: 4});
  });

  it('Should map a text vnode to its JSX text', function () {
    expect(originalPosition(compile(), 'createTextVNode(')).to.deep.equal({line: 5, column: 19});
  });

  it('Should map a fragment call to its opening tag', function () {
    expect(originalPosition(compile(), 'createFragment(')).to.deep.equal({line: 10, column: 2});
  });

  it('Should map normalizeProps and the call it wraps to the opening tag', function () {
    expect(originalPosition(compile(), 'normalizeProps(')).to.deep.equal({line: 11, column: 4});
    expect(originalPosition(compile(), 'createVNode(1, "b"')).to.deep.equal({line: 11, column: 4});
  });
});
