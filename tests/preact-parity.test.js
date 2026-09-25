// Shapes from Preact's runtime tests (~/git/preact test/browser, compat/test/browser); Preact has no compile-output tests.

var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('Preact parity', function () {
  describe('children and text', function () {
    it('Should not merge text with a string literal child (hydrate.test)', function () {
      expect(transform('<p>hello {"foo"}</p>')).to.equal('createVNode(1, "p", null, [createTextVNode("hello "), createTextVNode("foo")], 0);');
    });

    it('Should keep text between falsy expression children (render.test)', function () {
      expect(transform('<div>{null},{undefined},{false},{0},{NaN}</div>')).to.equal('createVNode(1, "div", null, [null, createTextVNode(","), undefined, createTextVNode(","), false, createTextVNode(","), 0, createTextVNode(","), NaN], 0);');
    });

    it('Should keep text on the first and last lines around elements (render.test)', function () {
      expect(transform('<div>0<span />\n<input />\n<div />1</div>')).to.equal('createVNode(1, "div", null, [createTextVNode("0"), createVNode(1, "span"), createVNode(64, "input"), createVNode(1, "div"), createTextVNode("1")], 4);');
    });

    it('Should keep the trailing space before an element (render.test)', function () {
      expect(transform('<div>hello <span>world</span></div>')).to.equal('createVNode(1, "div", null, [createTextVNode("hello "), createVNode(1, "span", null, "world", 16)], 4);');
    });

    it('Should keep quotes and = in text (render.test)', function () {
      expect(transform('<a href="#">href="#"</a>')).to.equal('createVNode(1, "a", null, "href=\\"#\\"", 16, {\n  "href": "#"\n});');
    });

    it('Should split text and an expression without space (render.test)', function () {
      expect(transform('<h1 class="fade-down">Hi{name}</h1>')).to.equal('createVNode(1, "h1", "fade-down", [createTextVNode("Hi"), name], 0);');
    });

    it('Should pass an array children prop to a component (createElement.test)', function () {
      expect(transform('<Foo a="b" children={[<span class="bar">bar</span>, "123", 456]} />')).to.equal('createComponentVNode(2, Foo, {\n  "a": "b",\n  "children": [createVNode(1, "span", "bar", "bar", 16), "123", 456]\n});');
    });

    it('Should prefer JSX children over an array children prop (render.test)', function () {
      expect(transform('<div a children={["a", "b"]}>c</div>')).to.equal('createVNode(1, "div", null, "c", 16, {\n  "a": true\n});');
    });

    it('Should compile a function child of a lowercase consumer (createContext.test)', function () {
      expect(transform('<context.Consumer>{v => <p>{v.state}</p>}</context.Consumer>')).to.equal('createComponentVNode(2, context.Consumer, {\n  children: v => createVNode(1, "p", null, v.state, 0)\n});');
    });
  });

  describe('spread (compat tests)', function () {
    it('Should keep several spreads', function () {
      expect(transform('<Inner {...data} {...childData} />')).to.equal('normalizeProps(createComponentVNode(2, Inner, {\n  ...data,\n  ...childData\n}));');
    });

    it('Should keep class before a spread', function () {
      expect(transform('<ul class="old" {...props} />')).to.equal('normalizeProps(createVNode(1, "ul", "old", null, 1, {\n  ...props\n}));');
    });

    it('Should keep a template literal className before a spread', function () {
      expect(transform('<div className={`${className} foo`} {...props} />')).to.equal('normalizeProps(createVNode(1, "div", `${className} foo`, null, 1, {\n  ...props\n}));');
    });

    it('Should keep a key after a spread of an object with a nested spread', function () {
      expect(transform('<ListItem {...{ isSelected, setSelected, ...item }} key={item.name} />')).to.equal('normalizeProps(createComponentVNode(2, ListItem, {\n  ...{\n    isSelected,\n    setSelected,\n    ...item\n  }\n}, item.name));');
    });

    it('Should keep a conditional class expression on svg', function () {
      expect(transform('<svg class={c && "bar_" + c} />')).to.equal('createVNode(32, "svg", c && "bar_" + c);');
    });
  });

  describe('attribute values', function () {
    it('Should pass falsy attribute values verbatim', function () {
      expect(transform('<div a0={0} anull={null} anan={NaN} afalse={false} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "a0": 0,\n  "anull": null,\n  "anan": NaN,\n  "afalse": false\n});');
    });

    it('Should pass boolean-like attributes verbatim', function () {
      expect(transform('<a download popover translate={false} aria-checked={false} data-checked={false} />')).to.equal('createVNode(1, "a", null, null, 1, {\n  "download": true,\n  "popover": true,\n  "translate": false,\n  "aria-checked": false,\n  "data-checked": false\n});');
    });

    it('Should pass a style string', function () {
      expect(transform('<div style="top: 5px; position: relative;" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "style": "top: 5px; position: relative;"\n});');
    });

    it('Should pass a style object with mixed key styles', function () {
      expect(transform('<div style={{gridRowStart: 1, opacity: 0, "--fooBar": 1, "background-size": "cover"}} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "style": {\n    gridRowStart: 1,\n    opacity: 0,\n    "--fooBar": 1,\n    "background-size": "cover"\n  }\n});');
    });

    it('Should pass a false table border', function () {
      expect(transform('<table border={false} />')).to.equal('createVNode(1, "table", null, null, 1, {\n  "border": false\n});');
    });

    it('Should lowercase rowSpan and colSpan', function () {
      expect(transform('<td rowSpan={2} colSpan={2} />')).to.equal('createVNode(1, "td", null, null, 1, {\n  "rowspan": 2,\n  "colspan": 2\n});');
    });

    it('Should lowercase null maxLength and minLength', function () {
      expect(transform('<input maxLength={null} minLength={null} />')).to.equal('createVNode(64, "input", null, null, 1, {\n  "maxlength": null,\n  "minlength": null\n});');
    });
  });

  describe('form controls', function () {
    it('Should compile a multiple select with an array value', function () {
      expect(transform('<select multiple value={["B", "C"]}><option selected value="B">B</option></select>')).to.equal('createVNode(256, "select", null, createVNode(1, "option", null, "B", 16, {\n  "selected": true,\n  "value": "B"\n}), 2, {\n  "multiple": true,\n  "value": ["B", "C"]\n});');
    });

    it('Should compile a select with defaultValue', function () {
      expect(transform('<select defaultValue="2"><option value="2">2</option></select>')).to.equal('createVNode(256, "select", null, createVNode(1, "option", null, "2", 16, {\n  "value": "2"\n}), 2, {\n  "defaultValue": "2"\n});');
    });

    it('Should compile a textarea with defaultValue', function () {
      expect(transform('<textarea defaultValue="foo" />')).to.equal('createVNode(128, "textarea", null, null, 1, {\n  "defaultValue": "foo"\n});');
    });

    it('Should compile a textarea with a null value', function () {
      expect(transform('<textarea value={null} />')).to.equal('createVNode(128, "textarea", null, null, 1, {\n  "value": null\n});');
    });

    it('Should compile a range input', function () {
      expect(transform('<input type="range" value={0.5} min="0" max="1" step="0.05" />')).to.equal('createVNode(64, "input", null, null, 1, {\n  "type": "range",\n  "value": 0.5,\n  "min": "0",\n  "max": "1",\n  "step": "0.05"\n});');
    });

    it('Should compile defaultChecked with checked false', function () {
      expect(transform('<input defaultChecked checked={false} />')).to.equal('createVNode(64, "input", null, null, 1, {\n  "defaultChecked": true,\n  "checked": false\n});');
    });

    it('Should compile a progress element', function () {
      expect(transform('<progress value={50} max="100" />')).to.equal('createVNode(1, "progress", null, null, 1, {\n  "value": 50,\n  "max": "100"\n});');
    });
  });

  describe('tags', function () {
    it('Should compile annotation-xml as an element', function () {
      expect(transform('<annotation-xml encoding="text/html" />')).to.equal('createVNode(1, "annotation-xml", null, null, 1, {\n  "encoding": "text/html"\n});');
    });

    it('Should compile new html tags', function () {
      expect(transform('<search><selectedcontent /></search>')).to.equal('createVNode(1, "search", null, createVNode(1, "selectedcontent"), 2);');
    });

    it('Should compile keyed children of a template', function () {
      expect(transform('<template>{items.map(i => <li key={i}>{i}</li>)}</template>')).to.equal('createVNode(1, "template", null, items.map(i => createVNode(1, "li", null, i, 0, null, i)), 0);');
    });

    it('Should keep an explicit xmlns on svg', function () {
      expect(transform('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" />')).to.equal('createVNode(32, "svg", null, null, 1, {\n  "xmlns": "http://www.w3.org/2000/svg",\n  "viewBox": "0 0 1 1"\n});');
    });

    it('Should keep the is attribute', function () {
      expect(transform('<div is="built-in" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "is": "built-in"\n});');
    });
  });

  // Invalid nesting and handler shapes compile normally; validation is left to the runtime
  describe('shapes rejected by preact/debug', function () {
    it('Should compile a div inside a paragraph', function () {
      expect(transform('<p><div /></p>')).to.equal('createVNode(1, "p", null, createVNode(1, "div"), 2);');
    });

    it('Should compile nested anchors', function () {
      expect(transform('<a><a /></a>')).to.equal('createVNode(1, "a", null, createVNode(1, "a"), 2);');
    });

    it('Should compile nested buttons', function () {
      expect(transform('<button><button /></button>')).to.equal('createVNode(1, "button", null, createVNode(1, "button"), 2);');
    });

    it('Should compile a table row inside a div', function () {
      expect(transform('<div><tr /></div>')).to.equal('createVNode(1, "div", null, createVNode(1, "tr"), 2);');
    });

    it('Should compile a table cell inside tbody', function () {
      expect(transform('<tbody><td /></tbody>')).to.equal('createVNode(1, "tbody", null, createVNode(1, "td"), 2);');
    });

    it('Should compile a complete table', function () {
      expect(transform('<table><tbody><tr><td /></tr></tbody></table>')).to.equal('createVNode(1, "table", null, createVNode(1, "tbody", null, createVNode(1, "tr", null, createVNode(1, "td"), 2), 2), 2);');
    });
  });

  describe('TSX variants', function () {
    it('Should pass a const asserted array children prop to a component', function () {
      expect(stripInfernoImport(transformTSX('<Foo a="b" children={[<span class="bar">bar</span>, "123", 456] as const} />'))).to.equal('createComponentVNode(2, Foo, {\n  "a": "b",\n  "children": [createVNode(1, "span", "bar", "bar", 16), "123", 456]\n});');
    });

    it('Should compile a typed function child of a lowercase consumer', function () {
      expect(stripInfernoImport(transformTSX('<context.Consumer>{(v: State) => <p>{v.state}</p>}</context.Consumer>'))).to.equal('createComponentVNode(2, context.Consumer, {\n  children: v => createVNode(1, "p", null, v.state, 0)\n});');
    });

    it('Should keep a key after a spread on a generic component', function () {
      expect(stripInfernoImport(transformTSX('<ListItem<Item> {...{ isSelected, setSelected, ...item }} key={item.name} />'))).to.equal('normalizeProps(createComponentVNode(2, ListItem, {\n  ...{\n    isSelected,\n    setSelected,\n    ...item\n  }\n}, item.name));');
    });

    it('Should compile a multiple select with a satisfies array value', function () {
      expect(stripInfernoImport(transformTSX('<select multiple value={["B", "C"] satisfies string[]}><option selected value="B">B</option></select>'))).to.equal('createVNode(256, "select", null, createVNode(1, "option", null, "B", 16, {\n  "selected": true,\n  "value": "B"\n}), 2, {\n  "multiple": true,\n  "value": ["B", "C"]\n});');
    });
  });
});
