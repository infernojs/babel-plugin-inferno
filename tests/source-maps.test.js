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

  it('Should emit a source map for the original file', function () {
    expect(compile().map.sources).to.deep.equal(['input.jsx']);
  });

  it('Should keep the mappings of the code around JSX after inserting the import', function () {
    var result = compile();

    expect(originalPosition(result, 'const x')).to.deep.equal({line: 1, column: 0});
    expect(originalPosition(result, 'const el')).to.deep.equal({line: 3, column: 0});
    expect(originalPosition(result, 'const f')).to.deep.equal({line: 9, column: 0});
  });

  it('Should keep the mappings of expressions inside JSX', function () {
    var result = compile();

    expect(originalPosition(result, '"bar": x', 7)).to.deep.equal({line: 5, column: 14});
    expect(originalPosition(result, '...p', 3)).to.deep.equal({line: 11, column: 11});
  });

  it('Should keep the mappings of the code around JSX after requiring helpers in a script', function () {
    var result = babelTransform({imports: true}, input, {sourceMaps: true, filename: 'input.jsx', sourceType: 'script'});

    expect(result.code).to.match(/^var _inferno = require\("inferno"\)/);
    expect(originalPosition(result, 'const x')).to.deep.equal({line: 1, column: 0});
    expect(originalPosition(result, 'const f')).to.deep.equal({line: 9, column: 0});
  });

  describe('tag names', function () {
    var tags = babelTransform({imports: true}, 'const el = (\n  <div>\n    <Ns.Inner.Comp />\n    <this.Item />\n    <Foo.bar-baz />\n  </div>\n);', {sourceMaps: true, filename: 'input.jsx'});

    it('Should map a component tag to its name', function () {
      expect(originalPosition(compile(), '2, Foo', 3)).to.deep.equal({line: 5, column: 5});
    });

    it('Should map an element tag to its name', function () {
      expect(originalPosition(tags, '1, "div"', 3)).to.deep.equal({line: 2, column: 3});
    });

    it('Should map every part of a member expression tag', function () {
      expect(originalPosition(tags, '2, Ns', 3)).to.deep.equal({line: 3, column: 5});
      expect(originalPosition(tags, 'Ns.Inner', 3)).to.deep.equal({line: 3, column: 8});
      expect(originalPosition(tags, 'Inner.Comp', 6)).to.deep.equal({line: 3, column: 14});
    });

    it('Should map this and the property of a this member expression tag', function () {
      expect(originalPosition(tags, '2, this', 3)).to.deep.equal({line: 4, column: 5});
      expect(originalPosition(tags, 'this.Item', 5)).to.deep.equal({line: 4, column: 10});
    });

    it('Should map a computed property of a member expression tag', function () {
      expect(originalPosition(tags, '"bar-baz"', 0)).to.deep.equal({line: 5, column: 9});
    });
  });

  it('Should map a call that replaces JSX on the same line', function () {
    var result = babelTransform({imports: true}, 'import {a} from "b";\nexport const el = <div>{a}</div>;', {sourceMaps: true, filename: 'input.jsx'});

    expect(originalPosition(result, 'createVNode(')).to.deep.equal({line: 2, column: 18});
  });
});
