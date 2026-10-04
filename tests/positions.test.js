var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var stripInfernoImport = helpers.stripInfernoImport;

describe('JSX positions', function () {
  describe('expression positions', function () {
    it('Should compile JSX in default parameters', function () {
      expect(transform('function F({x = <b/>}) { return <div>{x}</div>; }')).to.equal('function F({\n  x = newVNode(17, "b")\n}) {\n  return newVNode(1, "div", null, x);\n}');
    });

    it('Should compile JSX in static class fields', function () {
      expect(transform('class C { static el = <i/>; }')).to.equal('class C {\n  static el = newVNode(17, "i");\n}');
    });

    it('Should compile JSX in a class field arrow function', function () {
      expect(transform('class A { render = () => <this.subComponent />; }')).to.equal('class A {\n  render = () => newComponentVNode(0, this.subComponent);\n}');
    });

    it('Should compile JSX in a default export', function () {
      expect(transform('export default () => <div/>;')).to.equal('export default () => newVNode(17, "div");');
    });

    it('Should compile JSX in a named export', function () {
      expect(transform('export const A = () => <div/>;')).to.equal('export const A = () => newVNode(17, "div");');
    });

    it('Should compile JSX inside higher-order component calls', function () {
      expect(transform('const C = memo(forwardRef((props, ref) => <div ref={ref}/>));')).to.equal('const C = memo(forwardRef((props, ref) => newVNode(17, "div", null, null, null, null, ref)));');
    });

    it('Should compile several top-level JSX expression statements', function () {
      expect(transform('<div>{a}</div>;\n<span>{b}</span>')).to.equal('newVNode(1, "div", null, a);\nnewVNode(1, "span", null, b);');
    });

    it('Should compile JSX used as a component variable', function () {
      expect(transform('let Foo = <div />;\n<Foo />;')).to.equal('let Foo = newVNode(17, "div");\nnewComponentVNode(0, Foo);');
    });
  });

  describe('JSX created by other plugins', function () {
    it('Should compile JSX nodes built without source locations', function () {
      var t = helpers.babel.types;
      var makeJSX = function () {
        return {
          visitor: {
            CallExpression: function (path) {
              if (path.get('callee').isIdentifier({name: 'makeJSX'})) {
                path.replaceWith(t.jsxElement(
                  t.jsxOpeningElement(t.jsxIdentifier('div'), [t.jsxAttribute(t.jsxIdentifier('title'), t.stringLiteral('generated'))]),
                  t.jsxClosingElement(t.jsxIdentifier('div')),
                  [t.jsxText('text')]
                ));
              }
            }
          }
        };
      };
      var code = helpers.babel.transformSync('const el = makeJSX();', {
        babelrc: false,
        configFile: false,
        plugins: [makeJSX, [helpers.plugin, {imports: true}]]
      }).code;

      expect(stripInfernoImport(code)).to.equal('const el = newVNode(3, "div", null, "text", {\n  "title": "generated"\n});');
    });
  });
});
