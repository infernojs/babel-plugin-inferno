var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var expectValidJS = helpers.expectValidJS;

describe('Attributes', function () {
  describe('verbatim attributes', function () {
    it('Should keep data- and aria- attributes', function () {
      expect(transform('<div data-foo="1" aria-label="x" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "data-foo": "1",\n  "aria-label": "x"\n});');
    });

    it('Should keep multi-hyphen data attributes', function () {
      expect(transform('<div data-foo-bar={x} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "data-foo-bar": x\n});');
    });

    it('Should keep the casing of data attributes', function () {
      expect(transform('<div data-fooBar="true" aria="hello" on="tap:x" oncustomevent={f} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "data-fooBar": "true",\n  "aria": "hello",\n  "on": "tap:x",\n  "oncustomevent": f\n});');
    });

    it('Should keep namespaced attributes', function () {
      expect(transform('<div xml:lang="en" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "xml:lang": "en"\n});');
    });

    it('Should keep namespaced attributes with hyphens', function () {
      expect(transform('<div foo:bar-baz="1" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "foo:bar-baz": "1"\n});');
    });

    it('Should keep xmlns:xlink on svg', function () {
      expect(transform('<svg viewBox="0 0 10 10" xmlns:xlink="http://www.w3.org/1999/xlink"><g><path d="M0"/></g></svg>')).to.equal('createVNode(32, "svg", null, createVNode(32, "g", null, createVNode(32, "path", null, null, 1, {\n  "d": "M0"\n}), 2), 2, {\n  "viewBox": "0 0 10 10",\n  "xmlns:xlink": "http://www.w3.org/1999/xlink"\n});');
    });

    it('Should keep an uppercase CHILDREN attribute as a prop', function () {
      expect(transform('<div CHILDREN="5" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "CHILDREN": "5"\n});');
    });

    it('Should keep the is attribute next to mapped attributes', function () {
      expect(transform('<div is="custom-element" htmlFor="x" className="y" />')).to.equal('createVNode(1, "div", "y", null, 1, {\n  "is": "custom-element",\n  "for": "x"\n});');
    });
  });

  describe('reserved words and hyphens as names', function () {
    it('Should quote reserved words and hyphenated names on components', function () {
      expect(transform('<F aaa new const var default foo-bar/>')).to.equal('createComponentVNode(2, F, {\n  "aaa": true,\n  "new": true,\n  "const": true,\n  "var": true,\n  "default": true,\n  "foo-bar": true\n});');
    });

    it('Should quote reserved words on elements', function () {
      expect(transform('<div new const="1" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "new": true,\n  "const": "1"\n});');
    });
  });

  describe('values', function () {
    it('Should compile valueless attributes to true', function () {
      expect(transform('<input value={1} checked={c} defaultValue="x" defaultChecked />')).to.equal('createVNode(64, "input", null, null, 1, {\n  "value": 1,\n  "checked": c,\n  "defaultValue": "x",\n  "defaultChecked": true\n});');
    });

    it('Should keep a style object', function () {
      expect(transform('<div style={{color: "red"}} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "style": {\n    color: "red"\n  }\n});');
    });

    it('Should keep a style string', function () {
      expect(transform('<div style="color: red" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "style": "color: red"\n});');
    });

    it('Should keep custom properties in a style object', function () {
      expect(transform('<div style={{"--foo": 5}} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "style": {\n    "--foo": 5\n  }\n});');
    });

    it('Should keep dangerouslySetInnerHTML', function () {
      expect(transform('<div dangerouslySetInnerHTML={{__html: x}} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "dangerouslySetInnerHTML": {\n    __html: x\n  }\n});');
    });

    it('Should emit both dangerouslySetInnerHTML and children', function () {
      expect(transform('<div dangerouslySetInnerHTML={{__html: "abcdef"}}>ghjkl</div>')).to.equal('createVNode(1, "div", null, "ghjkl", 16, {\n  "dangerouslySetInnerHTML": {\n    __html: "abcdef"\n  }\n});');
    });

    it('Should keep dangerouslySetInnerHTML on a void element', function () {
      expect(transform('<input dangerouslySetInnerHTML={{__html: "content"}} />')).to.equal('createVNode(64, "input", null, null, 1, {\n  "dangerouslySetInnerHTML": {\n    __html: "content"\n  }\n});');
    });
  });

  describe('className and class', function () {
    it('Should use the last of className and class', function () {
      expect(transform('<div className={a} class={b} />')).to.equal('createVNode(1, "div", b);');
    });

    it('Should use the last of class and className', function () {
      expect(transform('<div class="a" className="b" />')).to.equal('createVNode(1, "div", "b");');
    });

    it('Should pass an empty className', function () {
      expect(transform('<div className="" />')).to.equal('createVNode(1, "div", "");');
    });

    it('Should pass an undefined className', function () {
      expect(transform('<div className={undefined} />')).to.equal('createVNode(1, "div", undefined);');
    });

    it('Should omit a null className', function () {
      expect(transform('<div className={null} />')).to.equal('createVNode(1, "div", null);');
    });

    it('Should keep className and class as props on components', function () {
      expect(transform('<Foo className="x" class="y" />')).to.equal('createComponentVNode(2, Foo, {\n  "className": "x",\n  "class": "y"\n});');
    });

    it('Should use class on svg elements', function () {
      expect(transform('<svg class="a"><g className="b"/></svg>')).to.equal('createVNode(32, "svg", "a", createVNode(32, "g", "b"), 2);');
    });
  });

  describe('duplicate attributes', function () {
    it('Should use the last key', function () {
      expect(transform('<div key="a" key="b" />')).to.equal('createVNode(1, "div", null, null, 1, null, "b");');
    });

    it('Should keep both copies of a duplicate prop', function () {
      expect(transform('<p prop prop />')).to.equal('createVNode(1, "p", null, null, 1, {\n  "prop": true,\n  "prop": true\n});');
    });
  });

  describe('JSX as attribute values', function () {
    it('Should compile an element attribute value without braces on an element', function () {
      expect(transform('<div attr=<span/> />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "attr": createVNode(1, "span")\n});');
    });

    it('Should compile an element attribute value without braces on a component', function () {
      expect(transform('<Foo attr=<span/> />')).to.equal('createComponentVNode(2, Foo, {\n  "attr": createVNode(1, "span")\n});');
    });

    it('Should compile a fragment attribute value', function () {
      expect(transform('<Foo value={<>{a}</>} />')).to.equal('createComponentVNode(2, Foo, {\n  "value": createFragment(a, 0)\n});');
    });

    it('Should compile JSX in a conditional attribute value', function () {
      expect(transform('<a b={x ? <c /> : <d />} />')).to.equal('createVNode(1, "a", null, null, 1, {\n  "b": x ? createVNode(1, "c") : createVNode(1, "d")\n});');
    });

    it('Should compile render props and element props', function () {
      expect(transform('<Foo render={() => <div>{x}</div>} icon={<Icon/>} />')).to.equal('createComponentVNode(2, Foo, {\n  "render": () => createVNode(1, "div", null, x, 0),\n  "icon": createComponentVNode(2, Icon)\n});');
    });
  });

  describe('attribute layout', function () {
    it('Should keep multi-line expression attributes with comments', function () {
      var code = transform('<div attr2={\n  "foo" + "bar" +\n\n  "baz" + "bug"\n  // Extra line here.\n} />');

      expect(code).to.equal('createVNode(1, "div", null, null, 1, {\n  "attr2": "foo" + "bar" + "baz" + "bug"\n  // Extra line here.\n});');
      expectValidJS(code);
    });

    it('Should allow spaces around =', function () {
      expect(transform('<Trans b = "2" />')).to.equal('createComponentVNode(2, Trans, {\n  "b": "2"\n});');
    });

    it('Should allow a line break before =', function () {
      expect(transform('<Foo y\n={2 } z />')).to.equal('createComponentVNode(2, Foo, {\n  "y": 2,\n  "z": true\n});');
    });
  });

  describe('mapping tables only apply to elements', function () {
    it('Should not map htmlFor, acceptCharset or colSpan on components', function () {
      expect(transform('<Foo htmlFor="x" acceptCharset="y" colSpan={2} />')).to.equal('createComponentVNode(2, Foo, {\n  "htmlFor": "x",\n  "acceptCharset": "y",\n  "colSpan": 2\n});');
    });

    it('Should not map onDoubleClick on components', function () {
      expect(transform('<Foo onDoubleClick={f} />')).to.equal('createComponentVNode(2, Foo, {\n  "onDoubleClick": f\n});');
    });
  });

  describe('mapped attributes', function () {
    it('Should map httpEquiv and charSet', function () {
      expect(transform('<meta httpEquiv="refresh" charSet="utf-8" />')).to.equal('createVNode(1, "meta", null, null, 1, {\n  "http-equiv": "refresh",\n  "charset": "utf-8"\n});');
    });

    it('Should map textAnchor on svg text', function () {
      expect(transform('<svg><text textAnchor="middle" /></svg>')).to.equal('createVNode(32, "svg", null, createVNode(32, "text", null, null, 1, {\n  "text-anchor": "middle"\n}), 2);');
    });

    it('Should map transformOrigin', function () {
      expect(transform('<div transformOrigin="0 0" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "transform-origin": "0 0"\n});');
    });

    it('Should lowercase tabIndex, readOnly and maxLength', function () {
      expect(transform('<div tabIndex="1" readOnly maxLength={3} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "tabindex": "1",\n  "readonly": true,\n  "maxlength": 3\n});');
    });

    it('Should map onDoubleClick and keep ondblclick', function () {
      expect(transform('<div onDoubleClick={f} ondblclick={g} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "onDblClick": f,\n  "ondblclick": g\n});');
    });

    it('Should map accentHeight on font-face', function () {
      expect(transform('<font-face accentHeight={10} />')).to.equal('createVNode(32, "font-face", null, null, 1, {\n  "accent-height": 10\n});');
    });
  });

  describe('event names', function () {
    it('Should keep capture event names', function () {
      expect(transform('<div onClickCapture={f} onGotPointerCaptureCapture={g} onTouchMoveCapture={h} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "onClickCapture": f,\n  "onGotPointerCaptureCapture": g,\n  "onTouchMoveCapture": h\n});');
    });

    it('Should keep lowercase and custom event names', function () {
      expect(transform('<div onclick={f} onanimationend={g} onOtherClick={h} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "onclick": f,\n  "onanimationend": g,\n  "onOtherClick": h\n});');
    });

    it('Should keep newer event names', function () {
      expect(transform('<div onScrollEnd={a} onBeforeToggle={b} onCommand={c} onFormData={d} onAuxClick={e} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "onScrollEnd": a,\n  "onBeforeToggle": b,\n  "onCommand": c,\n  "onFormData": d,\n  "onAuxClick": e\n});');
    });

    it('Should keep onChange and onInput together', function () {
      expect(transform('<input onChange={f} onInput={g} />')).to.equal('createVNode(64, "input", null, null, 1, {\n  "onChange": f,\n  "onInput": g\n});');
    });

    it('Should keep focus events and false handlers', function () {
      expect(transform('<div onClick={false} onFocusIn={h} onFocusOut={i} />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "onClick": false,\n  "onFocusIn": h,\n  "onFocusOut": i\n});');
    });

    it('Should keep a string event handler on an element', function () {
      expect(transform('<div onclick="a" />')).to.equal('createVNode(1, "div", null, null, 1, {\n  "onclick": "a"\n});');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should pass true as className for a valueless className', function () {
      expect(transform('<div className />')).to.equal('createVNode(1, "div", true);');
    });

    // Babel keeps them as leading comments of the props
    it('Should drop comments between attributes', function () {
      expect(transform('<div\n  /* a multi-line\n     comment */\n  attr1="foo">\n  <span // a double-slash comment\n    attr2="bar"\n  />\n</div>')).to.equal('createVNode(1, "div", null, createVNode(1, "span", null, null, 1, {\n  "attr2": "bar"\n}), 2, {\n  "attr1": "foo"\n});');
    });
  });
});
