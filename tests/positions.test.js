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
      expect(transform('function F({x = <b/>}) { return <div>{x}</div>; }')).to.equal('function F({\n  x = createVNode(1, "b")\n}) {\n  return createVNode(1, "div", null, x, 0);\n}');
    });

    it('Should compile JSX in static class fields', function () {
      expect(transform('class C { static el = <i/>; }')).to.equal('class C {\n  static el = createVNode(1, "i");\n}');
    });

    it('Should compile JSX in a class field arrow function', function () {
      expect(transform('class A { render = () => <this.subComponent />; }')).to.equal('class A {\n  render = () => createComponentVNode(2, this.subComponent);\n}');
    });

    it('Should compile JSX in a default export', function () {
      expect(transform('export default () => <div/>;')).to.equal('export default () => createVNode(1, "div");');
    });

    it('Should compile JSX in a named export', function () {
      expect(transform('export const A = () => <div/>;')).to.equal('export const A = () => createVNode(1, "div");');
    });

    it('Should compile JSX inside higher-order component calls', function () {
      expect(transform('const C = memo(forwardRef((props, ref) => <div ref={ref}/>));')).to.equal('const C = memo(forwardRef((props, ref) => createVNode(1, "div", null, null, 1, null, null, ref)));');
    });

    it('Should compile several top-level JSX expression statements', function () {
      expect(transform('<div>{a}</div>;\n<span>{b}</span>')).to.equal('createVNode(1, "div", null, a, 0);\ncreateVNode(1, "span", null, b, 0);');
    });

    it('Should compile JSX used as a component variable', function () {
      expect(transform('let Foo = <div />;\n<Foo />;')).to.equal('let Foo = createVNode(1, "div");\ncreateComponentVNode(2, Foo);');
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

      expect(stripInfernoImport(code)).to.equal('const el = createVNode(1, "div", null, "text", 16, {\n  "title": "generated"\n});');
    });
  });
});
