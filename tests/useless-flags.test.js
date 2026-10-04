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

var NEEDS = {
  '$HasVNodeChildren': 'one element or component child',
  '$HasTextChildren': 'one text child',
  '$HasNonKeyedChildren': 'an array of elements or components',
  '$HasKeyedChildren': 'an array of elements or components that all have a key',
  '$ChildFlag={1}': 'no children'
};
var LABELS = {'$ChildFlag={1}': '$ChildFlag={1} (HasInvalidChildren)'};

// Why each child flag cannot have children of each shape; flags that are missing fit the shape
var SHAPE_ERRORS = {
  none: {
    '$HasVNodeChildren': 'there are no children',
    '$HasTextChildren': 'there are no children',
    '$HasNonKeyedChildren': 'there are no children',
    '$HasKeyedChildren': 'there are no children'
  },
  text: {
    '$HasVNodeChildren': 'the child is text',
    '$HasNonKeyedChildren': 'the child is text',
    '$HasKeyedChildren': 'the child is text',
    '$ChildFlag={1}': 'the child is text'
  },
  vnode: {
    '$HasTextChildren': 'the child is an element',
    '$HasNonKeyedChildren': 'the only child is an element, not an array',
    '$HasKeyedChildren': 'the only child is an element, not an array',
    '$ChildFlag={1}': 'the child is an element'
  },
  // Two elements without keys, or an element and an expression
  two: {
    '$HasVNodeChildren': 'there are 2 children',
    '$HasTextChildren': 'there are 2 children',
    '$HasKeyedChildren': 'the child at index 0 has no key',
    '$ChildFlag={1}': 'there are 2 children'
  },
  keyed: {
    '$HasVNodeChildren': 'there are 2 children',
    '$HasTextChildren': 'there are 2 children',
    '$ChildFlag={1}': 'there are 2 children'
  },
  // Text and another child
  textFirst: {
    '$HasVNodeChildren': 'there are 2 children',
    '$HasTextChildren': 'there are 2 children',
    '$HasKeyedChildren': 'the child at index 0 is text, which has no key',
    '$ChildFlag={1}': 'there are 2 children'
  },
  null: {
    '$HasVNodeChildren': 'the child is null, which renders nothing',
    '$HasTextChildren': 'the child is null, which renders nothing',
    '$HasNonKeyedChildren': 'the child is null, which renders nothing',
    '$HasKeyedChildren': 'the child is null, which renders nothing'
  },
  spread: {
    '$HasVNodeChildren': 'the child is a spread, which makes an array',
    '$HasTextChildren': 'the child is a spread, which makes an array',
    '$ChildFlag={1}': 'the child is a spread, which makes an array'
  },
  dynamic: {}
};

// The error for a child flag on children of a shape, or null when the flag fits them
function shapeError(flag, shape) {
  var reason = SHAPE_ERRORS[shape][flag];

  return reason ? (LABELS[flag] || flag) + ' needs ' + NEEDS[flag] + ', but ' + reason + '.' : null;
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

    // The shape of the children as the JSX shows it, see SHAPE_ERRORS
    var shapes = [
      ['<div FLAG />', 'none'],
      ['<div FLAG>\n  </div>', 'none'],
      ['<div FLAG>text</div>', 'text'],
      ['<div FLAG><a/></div>', 'vnode'],
      ['<div FLAG><Foo/></div>', 'vnode'],
      ['<div FLAG><></></div>', 'vnode'],
      ['<div FLAG><a/><b/></div>', 'two'],
      ['<div FLAG><a key="1"/><b key="2"/></div>', 'keyed'],
      ['<div FLAG>text<a/></div>', 'textFirst'],
      ['<input FLAG />', 'none'],
      ['<div FLAG children="t" />', 'text'],
      ['<div FLAG children={<a/>} />', 'vnode'],
      ['<div FLAG children=<a/> />', 'vnode'],
      ['<div FLAG children={<></>} />', 'vnode'],
      ['<div FLAG children={null} />', 'null'],
      ['<div FLAG children={a}><b/></div>', 'vnode'],
      ['<Fragment FLAG />', 'none'],
      ['<Fragment FLAG>text</Fragment>', 'text'],
      ['<Fragment FLAG><a/></Fragment>', 'vnode'],
      ['<Fragment FLAG><a/><b/></Fragment>', 'two'],
      ['<Fragment FLAG key="k"><a key="1"/><b key="2"/></Fragment>', 'keyed'],
      ['<Fragment FLAG children="t" />', 'text'],
      ['<Fragment FLAG children={null} />', 'null'],
      ['<Inferno.Fragment FLAG><a/></Inferno.Fragment>', 'vnode']
    ];

    CHILD_FLAGS.forEach(function (flag) {
      shapes.forEach(function (shape) {
        var input = shape[0].replace('FLAG', flag);
        var error = shapeError(flag, shape[1]);

        if (error) {
          it('Should throw for ' + JSON.stringify(input), function () {
            expect(function () {
              transform(input);
            }).to.throw(error);
          });
        } else {
          it('Should warn about ' + JSON.stringify(input), function () {
            expect(messages(input)).to.eql([flagName(flag) + KNOWN]);
          });
        }
      });
    });

    it('Should warn about every child flag when there are several', function () {
      expect(messages('<div $HasKeyedChildren $HasNonKeyedChildren><a key="1"/><b key="2"/></div>')).to.eql([
        '$HasKeyedChildren' + KNOWN,
        '$HasNonKeyedChildren' + KNOWN
      ]);
    });

    it('Should warn with a spread attribute', function () {
      expect(messages('<div {...p} $HasVNodeChildren><a/></div>')).to.eql(['$HasVNodeChildren' + KNOWN]);
    });

    it('Should not warn about $Flags on static children', function () {
      expect(warnings('<div $Flags={1}><a/></div>')).to.eql([]);
    });
  });

  describe('dynamic children', function () {
    var shapes = [
      ['<div FLAG>{a}</div>', 'dynamic'],
      ['<div FLAG>{...a}</div>', 'spread'],
      ['<div FLAG>text{a}</div>', 'textFirst'],
      ['<div FLAG><a/>{b}</div>', 'two'],
      ['<div FLAG>{<a/>}</div>', 'vnode'],
      ['<div FLAG>{"text"}</div>', 'text'],
      ['<div FLAG>{/* c */}<a/></div>', 'vnode'],
      ['<div FLAG children={a} />', 'dynamic'],
      ['<div FLAG children={"t"} />', 'text'],
      ['<div FLAG children={a}>\n  </div>', 'dynamic'],
      ['<div {...p} FLAG>{a}</div>', 'dynamic'],
      ['<Fragment FLAG>{a}</Fragment>', 'dynamic'],
      ['<Fragment FLAG children={a} />', 'dynamic'],
      ['<Fragment FLAG children={<a/>} />', 'vnode'],
      ['<Fragment FLAG children=<a/> />', 'vnode']
    ];

    CHILD_FLAGS.forEach(function (flag) {
      shapes.forEach(function (shape) {
        var input = shape[0].replace('FLAG', flag);
        var error = shapeError(flag, shape[1]);

        if (error) {
          it('Should throw for ' + JSON.stringify(input), function () {
            expect(function () {
              transform(input);
            }).to.throw(error);
          });
        } else {
          it('Should not warn about ' + JSON.stringify(input), function () {
            expect(warnings(input)).to.eql([]);
          });
        }
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

    it('Should not warn about $Flags on a component', function () {
      expect(warnings('<Foo $Flags={4}/>')).to.eql([]);
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
  });

  describe('Fragments', function () {
    var cases = [
      ['<Fragment $Flags={1}>{x}</Fragment>', '$Flags'],
      ['<Inferno.Fragment $Flags={1} key="k">{x}</Inferno.Fragment>', '$Flags'],
      ['<React.Fragment $Flags={1}>{x}</React.Fragment>', '$Flags']
    ];

    cases.forEach(function (testCase) {
      var input = testCase[0];
      var flag = testCase[1];

      it('Should warn about ' + flag + ' in ' + JSON.stringify(input), function () {
        expect(messages(input)).to.eql([flag + FRAGMENT]);
      });

      it('Should compile ' + JSON.stringify(input) + ' the same without ' + flag, function () {
        expect(transform(input)).to.equal(transform(input.replace(' $Flags={1}', '')));
      });
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
      expect(helpers.stripInfernoImport(result.result)).to.equal('const el = newVNode(3, "div", null, "text");');
    });
  });
});
