var path = require('path');
var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformWarnings = helpers.transformWarnings;
var transformWith = helpers.transformWith;

var KNOWN = ' is not needed: the children are known at compile time, so the plugin sets their child flags. Child flags only help with dynamic children such as {expression}.';
var COMPONENT = ' has no effect on components. Their children are passed in props.children.';
var FRAGMENT = ' has no effect on Fragments.';

var CHILD_FLAGS = ['$HasVNodeChildren', '$HasTextChildren', '$HasNonKeyedChildren', '$HasKeyedChildren', '$ChildFlag={1}'];

function flagName(flag) {
  return flag.split('=')[0];
}

function warnings(input, pluginOptions) {
  return transformWarnings(input, pluginOptions).warnings;
}

// The message of each warning, without the prefix, the location and the code frame
function messages(input, pluginOptions) {
  return warnings(input, pluginOptions).map(function (warning) {
    return warning.split('\n')[0].replace(/^babel-plugin-inferno: [^:]+:\d+:\d+: /, '');
  });
}

describe('Useless flags', function () {
  describe('children known at compile time', function () {
    it('Should warn about $HasVNodeChildren on a single static element', function () {
      var result = transformWarnings('<div $HasVNodeChildren><h1>Hi</h1></div>');

      expect(result.warnings).to.eql([
        'babel-plugin-inferno: unknown file:1:6: $HasVNodeChildren' + KNOWN + '\n' +
        '> 1 | <div $HasVNodeChildren><h1>Hi</h1></div>\n' +
        '    |      ^^^^^^^^^^^^^^^^^'
      ]);
      expect(result.code).to.equal(helpers.stripInfernoImport(transformWith({imports: true, uselessFlags: 'off'}, '<div $HasVNodeChildren><h1>Hi</h1></div>')));
    });

    it('Should point at the flag in multi-line code', function () {
      var result = transformWarnings('function App() {\n  return (\n    <div $HasVNodeChildren>\n      <h1>Hi</h1>\n    </div>\n  );\n}');

      expect(result.warnings).to.have.length(1);
      expect(result.warnings[0]).to.have.string('babel-plugin-inferno: unknown file:3:10: $HasVNodeChildren' + KNOWN + '\n');
      expect(result.warnings[0]).to.have.string('> 3 |     <div $HasVNodeChildren>\n');
    });

    var shapes = [
      '<div FLAG />',
      '<div FLAG>\n  </div>',
      '<div FLAG>text</div>',
      '<div FLAG><a/></div>',
      '<div FLAG><Foo/></div>',
      '<div FLAG><></></div>',
      '<div FLAG><a/><b/></div>',
      '<div FLAG><a key="1"/><b key="2"/></div>',
      '<div FLAG>text<a/></div>',
      '<input FLAG />',
      '<div FLAG children="t" />',
      '<div FLAG children={<a/>} />',
      '<div FLAG children=<a/> />',
      '<div FLAG children={<></>} />',
      '<div FLAG children={null} />',
      '<div FLAG children={a}><b/></div>',
      '<Fragment FLAG />',
      '<Fragment FLAG>text</Fragment>',
      '<Fragment FLAG><a/></Fragment>',
      '<Fragment FLAG><a/><b/></Fragment>',
      '<Fragment FLAG key="k"><a key="1"/><b key="2"/></Fragment>',
      '<Fragment FLAG children="t" />',
      '<Fragment FLAG children={null} />',
      '<Inferno.Fragment FLAG><a/></Inferno.Fragment>'
    ];

    CHILD_FLAGS.forEach(function (flag) {
      shapes.forEach(function (shape) {
        var input = shape.replace('FLAG', flag);

        it('Should warn about ' + JSON.stringify(input), function () {
          expect(messages(input)).to.eql([flagName(flag) + KNOWN]);
        });
      });
    });

    it('Should warn about every child flag when there are several', function () {
      expect(messages('<div $HasKeyedChildren $HasNonKeyedChildren><a/></div>')).to.eql([
        '$HasKeyedChildren' + KNOWN,
        '$HasNonKeyedChildren' + KNOWN
      ]);
    });

    it('Should warn with a spread attribute', function () {
      expect(messages('<div {...p} $HasVNodeChildren><a/></div>')).to.eql(['$HasVNodeChildren' + KNOWN]);
    });

    it('Should not warn about $Flags and $ReCreate on static children', function () {
      expect(warnings('<div $Flags={1}><a/></div>')).to.eql([]);
      expect(warnings('<div $ReCreate><a/></div>')).to.eql([]);
    });
  });

  describe('dynamic children', function () {
    var shapes = [
      '<div FLAG>{a}</div>',
      '<div FLAG>{...a}</div>',
      '<div FLAG>text{a}</div>',
      '<div FLAG><a/>{b}</div>',
      '<div FLAG>{<a/>}</div>',
      '<div FLAG>{"text"}</div>',
      '<div FLAG>{/* c */}<a/></div>',
      '<div FLAG children={a} />',
      '<div FLAG children={"t"} />',
      '<div FLAG children={a}>\n  </div>',
      '<div {...p} FLAG>{a}</div>',
      '<Fragment FLAG>{a}</Fragment>',
      '<Fragment FLAG children={a} />',
      '<Fragment FLAG children={<a/>} />',
      '<Fragment FLAG children=<a/> />'
    ];

    CHILD_FLAGS.forEach(function (flag) {
      shapes.forEach(function (shape) {
        var input = shape.replace('FLAG', flag);

        it('Should not warn about ' + JSON.stringify(input), function () {
          expect(warnings(input)).to.eql([]);
        });
      });
    });

    it('Should not warn about a $ChildFlag expression', function () {
      expect(warnings('<div $ChildFlag={x}>{a}</div>')).to.eql([]);
    });
  });

  describe('components', function () {
    CHILD_FLAGS.forEach(function (flag) {
      it('Should warn about ' + flagName(flag) + ' on a component', function () {
        expect(messages('<Foo ' + flag + '>{a}</Foo>')).to.eql([flagName(flag) + COMPONENT]);
      });
    });

    it('Should warn about a child flag on a component without children', function () {
      expect(messages('<Foo $HasVNodeChildren />')).to.eql(['$HasVNodeChildren' + COMPONENT]);
    });

    it('Should warn about a child flag on a member expression component', function () {
      expect(messages('<Ns.Foo $HasTextChildren>text</Ns.Foo>')).to.eql(['$HasTextChildren' + COMPONENT]);
    });

    it('Should warn about a child flag on a component with type arguments', function () {
      var result = helpers.transformTSXWarnings('<Foo<T> $HasKeyedChildren>{a}</Foo>');

      expect(result.warnings).to.have.length(1);
      expect(result.warnings[0]).to.have.string('file.tsx:1:9: $HasKeyedChildren' + COMPONENT);
    });

    it('Should warn about each child flag on a component', function () {
      expect(messages('<Foo $HasKeyedChildren $ChildFlag={1}>{a}</Foo>')).to.eql([
        '$HasKeyedChildren' + COMPONENT,
        '$ChildFlag' + COMPONENT
      ]);
    });

    it('Should compile the same without the child flag', function () {
      expect(transform('<Foo $HasKeyedChildren>{a}</Foo>')).to.equal(transform('<Foo>{a}</Foo>'));
    });

    it('Should not warn about $Flags or $ReCreate on a component', function () {
      expect(warnings('<Foo $Flags={4}/>')).to.eql([]);
      expect(warnings('<Foo $ReCreate/>')).to.eql([]);
    });
  });

  describe('conflicting flags', function () {
    var cases = [
      ['<div $HasKeyedChildren $HasNonKeyedChildren>{a}</div>', '$HasNonKeyedChildren', '$HasKeyedChildren'],
      ['<div $HasNonKeyedChildren $HasKeyedChildren>{a}</div>', '$HasNonKeyedChildren', '$HasKeyedChildren'],
      ['<div $HasTextChildren $HasVNodeChildren>{a}</div>', '$HasVNodeChildren', '$HasTextChildren'],
      ['<div $HasNonKeyedChildren $HasTextChildren>{a}</div>', '$HasTextChildren', '$HasNonKeyedChildren'],
      ['<div $ChildFlag={1} $HasKeyedChildren>{a}</div>', '$HasKeyedChildren', '$ChildFlag'],
      ['<div $HasVNodeChildren $ChildFlag={x}>{a}</div>', '$HasVNodeChildren', '$ChildFlag'],
      ['<Fragment $HasTextChildren $HasVNodeChildren>{a}</Fragment>', '$HasVNodeChildren', '$HasTextChildren'],
      ['<Fragment $HasKeyedChildren $HasNonKeyedChildren key="k">{a}</Fragment>', '$HasNonKeyedChildren', '$HasKeyedChildren']
    ];

    cases.forEach(function (testCase) {
      var input = testCase[0];
      var ignored = testCase[1];
      var winner = testCase[2];

      it('Should warn about ' + ignored + ' in ' + JSON.stringify(input), function () {
        expect(messages(input)).to.eql([ignored + ' is ignored because ' + winner + ' takes precedence. Remove one of them.']);
      });

      it('Should compile ' + JSON.stringify(input) + ' the same without ' + ignored, function () {
        var ignoredAttribute = new RegExp(' \\' + ignored + '(=\\{[^}]*\\})?');

        expect(transform(input)).to.equal(transform(input.replace(ignoredAttribute, '')));
      });
    });

    it('Should warn about every ignored child flag', function () {
      expect(messages('<div $HasVNodeChildren $HasTextChildren $ChildFlag={x}>{a}</div>')).to.eql([
        '$HasVNodeChildren is ignored because $ChildFlag takes precedence. Remove one of them.',
        '$HasTextChildren is ignored because $ChildFlag takes precedence. Remove one of them.'
      ]);
    });

    it('Should point at the ignored flag', function () {
      expect(warnings('<div $HasKeyedChildren $HasNonKeyedChildren>{a}</div>')[0]).to.match(/^babel-plugin-inferno: unknown file:1:24: /);
    });

    it('Should warn about $ReCreate with $Flags on an element', function () {
      expect(messages('<div $ReCreate $Flags={9}/>')).to.eql(['$ReCreate is ignored because $Flags replaces the vNode flags. Include ReCreate (2048) in $Flags instead.']);
      expect(transform('<div $ReCreate $Flags={9}/>')).to.equal(transform('<div $Flags={9}/>'));
    });

    it('Should warn about $ReCreate with $Flags on a component', function () {
      expect(messages('<Foo $Flags={2} $ReCreate/>')).to.eql(['$ReCreate is ignored because $Flags replaces the vNode flags. Include ReCreate (2048) in $Flags instead.']);
      expect(transform('<Foo $Flags={2} $ReCreate/>')).to.equal(transform('<Foo $Flags={2}/>'));
    });
  });

  describe('Fragments', function () {
    var cases = [
      ['<Fragment $Flags={1}>{x}</Fragment>', '$Flags'],
      ['<Fragment $ReCreate>{x}</Fragment>', '$ReCreate'],
      ['<Inferno.Fragment $Flags={1} key="k">{x}</Inferno.Fragment>', '$Flags'],
      ['<React.Fragment $ReCreate>{x}</React.Fragment>', '$ReCreate']
    ];

    cases.forEach(function (testCase) {
      var input = testCase[0];
      var flag = testCase[1];

      it('Should warn about ' + flag + ' in ' + JSON.stringify(input), function () {
        expect(messages(input)).to.eql([flag + FRAGMENT]);
      });

      it('Should compile ' + JSON.stringify(input) + ' the same without ' + flag, function () {
        expect(transform(input)).to.equal(transform(input.replace(/ \$(Flags=\{1\}|ReCreate)/, '')));
      });
    });

    it('Should warn about $Flags and $ReCreate together on a Fragment', function () {
      expect(messages('<Fragment $ReCreate $Flags={1}>{x}</Fragment>')).to.eql(['$ReCreate' + FRAGMENT, '$Flags' + FRAGMENT]);
    });

    it('Should warn about a Fragment flag and a child flag separately', function () {
      expect(messages('<Fragment $Flags={1} $HasNonKeyedChildren><a/><b/></Fragment>')).to.eql(['$Flags' + FRAGMENT, '$HasNonKeyedChildren' + KNOWN]);
    });
  });

  describe('nested JSX', function () {
    it('Should warn about a flag on a child element', function () {
      expect(warnings('<div>{a}<p $HasTextChildren>text</p></div>')).to.have.length(1);
      expect(warnings('<div>{a}<p $HasTextChildren>text</p></div>')[0]).to.match(/^babel-plugin-inferno: unknown file:1:12: \$HasTextChildren is not needed/);
    });

    it('Should warn about a flag in JSX inside an attribute', function () {
      expect(messages('<Foo icon={<b $HasVNodeChildren><i/></b>} />')).to.eql(['$HasVNodeChildren' + KNOWN]);
    });

    it('Should warn about a flag in a children prop', function () {
      expect(messages('<div children={<b $HasVNodeChildren><i/></b>} />')).to.eql(['$HasVNodeChildren' + KNOWN]);
    });

    it('Should warn once for each element', function () {
      expect(messages('<ul $HasNonKeyedChildren><li $HasTextChildren>a</li><li $HasTextChildren>b</li></ul>')).to.eql([
        '$HasTextChildren' + KNOWN,
        '$HasTextChildren' + KNOWN,
        '$HasNonKeyedChildren' + KNOWN
      ]);
    });
  });

  describe('uselessFlags option', function () {
    var input = '<div $HasVNodeChildren><h1>Hi</h1></div>';

    it('Should warn by default', function () {
      expect(messages(input, {})).to.eql(['$HasVNodeChildren' + KNOWN]);
    });

    it('Should warn with "warn"', function () {
      expect(messages(input, {uselessFlags: 'warn'})).to.eql(['$HasVNodeChildren' + KNOWN]);
    });

    it('Should not warn with "off"', function () {
      expect(warnings(input, {uselessFlags: 'off'})).to.eql([]);
      expect(warnings('<Foo $HasKeyedChildren>{a}</Foo>', {uselessFlags: 'off'})).to.eql([]);
    });

    it('Should throw with "error"', function () {
      expect(function () {
        transformWarnings(input, {uselessFlags: 'error'});
      }).to.throw('unknown file: $HasVNodeChildren' + KNOWN + '\n> 1 | <div $HasVNodeChildren><h1>Hi</h1></div>\n    |      ^^^^^^^^^^^^^^^^^');
    });

    it('Should throw for conflicting flags with "error"', function () {
      expect(function () {
        transformWarnings('<div $HasKeyedChildren $HasNonKeyedChildren>{a}</div>', {uselessFlags: 'error'});
      }).to.throw('$HasNonKeyedChildren is ignored because $HasKeyedChildren takes precedence. Remove one of them.');
    });

    it('Should compile the same with every level', function () {
      var expected = transformWarnings(input, {imports: true, uselessFlags: 'off'}).code;

      expect(transformWarnings(input, {imports: true, uselessFlags: 'warn'}).code).to.equal(expected);
      expect(transformWarnings(input, {imports: true}).code).to.equal(expected);
    });

    it('Should reject an unknown level', function () {
      expect(function () {
        transformWarnings(input, {uselessFlags: 'warning'});
      }).to.throw('babel-plugin-inferno: the uselessFlags option must be "warn", "error" or "off", got "warning".');
    });

    it('Should reject a boolean level', function () {
      expect(function () {
        transformWarnings(input, {uselessFlags: false});
      }).to.throw('babel-plugin-inferno: the uselessFlags option must be "warn", "error" or "off", got false.');
    });

    it('Should reject an unknown level in files without flags', function () {
      expect(function () {
        transformWarnings('<div/>', {uselessFlags: 'warning'});
      }).to.throw('the uselessFlags option must be');
    });
  });

  describe('warning format', function () {
    it('Should include the file name', function () {
      var result = transformWarnings('<div $HasVNodeChildren><h1>Hi</h1></div>', {imports: true}, {filename: 'App.jsx'});

      expect(result.warnings).to.have.length(1);
      expect(result.warnings[0].split('\n')[0]).to.equal('babel-plugin-inferno: ' + path.resolve(__dirname, '..', 'App.jsx') + ':1:6: $HasVNodeChildren' + KNOWN);
    });

    it('Should warn without a code frame about JSX built without source locations', function () {
      var t = helpers.babel.types;
      var makeJSX = function () {
        return {
          visitor: {
            CallExpression: function (callPath) {
              if (callPath.get('callee').isIdentifier({name: 'makeJSX'})) {
                callPath.replaceWith(t.jsxElement(
                  t.jsxOpeningElement(t.jsxIdentifier('div'), [t.jsxAttribute(t.jsxIdentifier('$HasTextChildren'))]),
                  t.jsxClosingElement(t.jsxIdentifier('div')),
                  [t.jsxText('text')]
                ));
              }
            }
          }
        };
      };
      var result = helpers.collectWarnings(function () {
        return helpers.babel.transformSync('const el = makeJSX();', {
          babelrc: false,
          configFile: false,
          plugins: [makeJSX, [helpers.plugin, {imports: true}]]
        }).code;
      });

      expect(result.warnings).to.eql(['babel-plugin-inferno: unknown file: $HasTextChildren' + KNOWN]);
      expect(helpers.stripInfernoImport(result.result)).to.equal('const el = createVNode(1, "div", null, "text", 16);');
    });
  });
});
