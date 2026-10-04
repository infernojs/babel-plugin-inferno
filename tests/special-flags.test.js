var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var transformTSX = helpers.transformTSX;
var stripInfernoImport = helpers.stripInfernoImport;

describe('Special flags', function () {
  describe('flag precedence', function () {
    it('Should throw for $HasVNodeChildren on text', function () {
      expect(function () {
        transform('<div $HasVNodeChildren>text</div>');
      }).to.throw('$HasVNodeChildren needs one element or component child, but the child is text.');
    });

    it('Should throw for $HasVNodeChildren on several children', function () {
      expect(function () {
        transform('<div $HasVNodeChildren><a/><b/></div>');
      }).to.throw('$HasVNodeChildren needs one element or component child, but there are 2 children.');
    });

    it('Should use $HasKeyedChildren for static children', function () {
      expect(transform('<div $HasKeyedChildren><a key="1"/><b key="2"/></div>')).to.equal('newVNode(33, "div", null, [newVNode(17, "a", null, null, null, "1"), newVNode(17, "b", null, null, null, "2")]);');
    });

    it('Should throw for $HasKeyedChildren on static children without keys', function () {
      expect(function () {
        transform('<div $HasKeyedChildren><a/><b/></div>');
      }).to.throw('$HasKeyedChildren needs an array of elements or components that all have a key, but the child at index 0 has no key.');
    });

    it('Should prefer $HasKeyedChildren over $HasNonKeyedChildren', function () {
      expect(transform('<div $HasKeyedChildren $HasNonKeyedChildren>{a}</div>')).to.equal('newVNode(33, "div", null, a);');
    });

    it('Should prefer $ChildFlag over other child flags', function () {
      expect(transform('<div $ChildFlag={1} $HasKeyedChildren>{a}</div>')).to.equal('newVNode(17, "div", null, a);');
    });

    it('Should prefer $Flags over contentEditable', function () {
      expect(transform('<div contentEditable $Flags={9}/>')).to.equal('newVNode(25, "div", null, null, {\n  "contentEditable": true\n});');
    });

    it('Should strip type syntax from a $ChildFlag expression', function () {
      expect(stripInfernoImport(transformTSX('<div $ChildFlag={flag as ChildFlags}>{a}</div>'))).to.equal('createVNode(1, "div", null, a, flag);');
    });

    it('Should use a $Flags expression as the flags of a generic component', function () {
      expect(stripInfernoImport(transformTSX('<Foo<T> $Flags={flags as number} />'))).to.equal('newComponentVNode(flags | 16, Foo);');
    });
  });

  describe('child flags that the children cannot have', function () {
    var transformWith = helpers.transformWith;

    function error(input, options) {
      try {
        transformWith(options || {imports: false, uselessFlags: 'off'}, input);
      } catch (e) {
        return e.message;
      }
      return null;
    }

    it('Should point at the flag with a code frame', function () {
      expect(error('function App() {\n  return (\n    <ul $HasKeyedChildren>\n      <li/>\n    </ul>\n  );\n}')).to.equal(
        'unknown file: $HasKeyedChildren needs an array of elements or components that all have a key, but the only child is an element, not an array.\n' +
        '  1 | function App() {\n' +
        '  2 |   return (\n' +
        '> 3 |     <ul $HasKeyedChildren>\n' +
        '    |         ^^^^^^^^^^^^^^^^^\n' +
        '  4 |       <li/>\n' +
        '  5 |     </ul>\n' +
        '  6 |   );'
      );
    });

    it('Should throw whatever the uselessFlags option is', function () {
      var input = '<div $HasVNodeChildren>{[a, b]}</div>';
      var message = '$HasVNodeChildren needs one element or component child, but the child is an array.';

      expect(error(input, {uselessFlags: 'off'})).to.have.string(message);
      expect(error(input, {uselessFlags: 'warn'})).to.have.string(message);
      expect(error(input, {uselessFlags: 'error'})).to.have.string(message);
    });

    it('Should throw for an array children prop with $HasVNodeChildren', function () {
      expect(error('<div $HasVNodeChildren children={[a, b]} />')).to.have.string('$HasVNodeChildren needs one element or component child, but the child is an array.');
    });

    it('Should throw for literal text with $HasVNodeChildren', function () {
      expect(error('<div $HasVNodeChildren>{`a${b}`}</div>')).to.have.string('$HasVNodeChildren needs one element or component child, but the child is text.');
      expect(error('<div $HasVNodeChildren>{1}</div>')).to.have.string('$HasVNodeChildren needs one element or component child, but the child is text.');
    });

    it('Should throw for a boolean child with $HasTextChildren', function () {
      expect(error('<div $HasTextChildren>{true}</div>')).to.have.string('$HasTextChildren needs one text child, but the child is true, which renders nothing.');
    });

    it('Should throw for an array item without a key with $HasKeyedChildren', function () {
      expect(error('<div $HasKeyedChildren>{[<a key="1"/>, <b/>]}</div>')).to.have.string('$HasKeyedChildren needs an array of elements or components that all have a key, but the array item at index 1 has no key.');
    });

    it('Should not throw for an array of keyed items with $HasKeyedChildren', function () {
      expect(error('<div $HasKeyedChildren>{[<a key="1"/>, <b key="2"/>]}</div>')).to.equal(null);
    });

    it('Should throw for a child that renders nothing in non keyed children', function () {
      expect(error('<div $HasNonKeyedChildren><a/>{null}</div>')).to.have.string('$HasNonKeyedChildren needs an array of elements or components, but the child at index 1 is null, which renders nothing.');
    });

    it('Should throw for a nested array in non keyed children', function () {
      expect(error('<div $HasNonKeyedChildren><a/>{[b]}</div>')).to.have.string('$HasNonKeyedChildren needs an array of elements or components, but the child at index 1 is an array, which makes a nested array.');
    });

    it('Should not throw for text next to elements in non keyed children', function () {
      expect(error('<div $HasNonKeyedChildren><a/>text</div>')).to.equal(null);
    });

    it('Should only check the child flag that takes precedence', function () {
      expect(error('<div $HasNonKeyedChildren $HasVNodeChildren><a/><b/></div>')).to.equal(null);
      expect(error('<div $HasVNodeChildren $HasNonKeyedChildren><a/></div>')).to.have.string('$HasNonKeyedChildren needs an array of elements or components, but the only child is an element, not an array.');
    });

    it('Should not check child flags on components', function () {
      expect(error('<Foo $HasVNodeChildren>text</Foo>')).to.equal(null);
      expect(error('<Foo $ChildFlag={3}>text</Foo>')).to.equal(null);
    });

    it('Should not check $ChildFlag expressions and UnknownChildren', function () {
      expect(error('<div $ChildFlag={flag}>text</div>')).to.equal(null);
      expect(error('<div $ChildFlag={0}>text</div>')).to.equal(null);
    });

    it('Should check a numeric $ChildFlag like the flag of its value', function () {
      expect(error('<div $ChildFlag={2}>text</div>')).to.have.string('$ChildFlag={2} (HasVNodeChildren) needs one element or component child, but the child is text.');
      expect(error('<div $ChildFlag={16}><a/></div>')).to.have.string('$ChildFlag={16} (HasTextChildren) needs one text child, but the child is an element.');
    });

    it('Should look through parentheses and type assertions', function () {
      function tsxError(input) {
        try {
          transformTSX(input);
        } catch (e) {
          return e.message;
        }
        return null;
      }

      expect(tsxError('<div $HasVNodeChildren>{"t" as string}</div>')).to.have.string('$HasVNodeChildren needs one element or component child, but the child is text.');
      expect(tsxError('<div $HasTextChildren children={<a/> as any} />')).to.have.string('$HasTextChildren needs one text child, but the child is an element.');
      expect(tsxError('<div $HasTextChildren>{(<a/>)!}</div>')).to.have.string('$HasTextChildren needs one text child, but the child is an element.');
      expect(tsxError('<div $HasKeyedChildren>{[<a/> satisfies object]}</div>')).to.have.string('$HasKeyedChildren needs an array of elements or components that all have a key, but the array item at index 0 has no key.');
      expect(tsxError('<div $HasVNodeChildren>{(x as any)}</div>')).to.equal(null);
    });

    it('Should not throw for dynamic children', function () {
      expect(error('<div $HasVNodeChildren>{cond ? <a/> : null}</div>')).to.equal(null);
      expect(error('<div $HasTextChildren>{name}</div>')).to.equal(null);
      expect(error('<div $HasKeyedChildren>{items.map(render)}</div>')).to.equal(null);
    });
  });

  describe('packed flags of the v10 factories', function () {
    var transformWith = helpers.transformWith;

    it('Should put the child bit of each children shape into the flags', function () {
      expect(transform('<div/>')).to.equal('newVNode(17, "div");');
      expect(transform('<div>text</div>')).to.equal('newVNode(3, "div", null, "text");');
      expect(transform('<div><a/><b/></div>')).to.equal('newVNode(5, "div", null, [newVNode(17, "a"), newVNode(17, "b")]);');
      expect(transform('<div><a/></div>')).to.equal('newVNode(9, "div", null, newVNode(17, "a"));');
      expect(transform('<div $HasKeyedChildren>{a}</div>')).to.equal('newVNode(33, "div", null, a);');
    });

    it('Should leave the child bit out for children that are normalized', function () {
      expect(transform('<div>{a}</div>')).to.equal('newVNode(1, "div", null, a);');
    });

    it('Should keep the element flags of svg and form elements', function () {
      expect(transform('<svg><path/></svg>')).to.equal('newVNode(72, "svg", null, newVNode(80, "path"));');
      expect(transform('<input/>')).to.equal('newVNode(528, "input");');
    });

    it('Should give components the ComponentUnknown flags, which are 0', function () {
      expect(transform('<Foo/>')).to.equal('newComponentVNode(0, Foo);');
    });

    it('Should add the child bit to a $Flags expression', function () {
      expect(transform('<div $Flags={f}>text</div>')).to.equal('newVNode(f | 2, "div", null, "text");');
      expect(transform('<div $Flags={a ? b : c}/>')).to.equal('newVNode((a ? b : c) | 16, "div");');
    });

    it('Should not add a child bit to a $Flags expression of normalized children', function () {
      expect(transform('<div $Flags={f}>{a}</div>')).to.equal('newVNode(f, "div", null, a);');
    });

    it('Should fold a numeric $ChildFlag into the flags', function () {
      expect(transform('<div $ChildFlag={16}>{a}</div>')).to.equal('newVNode(3, "div", null, a);');
    });

    it('Should throw for a $ChildFlag number that is not a ChildFlags value', function () {
      expect(function () {
        transform('<div $ChildFlag={3}>{a}</div>');
      }).to.throw('$ChildFlag={3} is not a ChildFlags value. Use 0 (UnknownChildren), 1 (HasInvalidChildren), 2 (HasVNodeChildren), 4 (HasNonKeyedChildren), 8 (HasKeyedChildren) or 16 (HasTextChildren).');
    });

    it('Should import createVNode next to newVNode for a $ChildFlag expression', function () {
      expect(transformWith({imports: true}, '<div><span $ChildFlag={flag}>{a}</span></div>')).to.equal('import { newVNode, createVNode } from "inferno";\nnewVNode(9, "div", null, createVNode(1, "span", null, a, flag));');
    });

    it('Should call createFragment for a $ChildFlag expression on a Fragment', function () {
      expect(transformWith({imports: true}, '<Fragment $ChildFlag={flag}>{a}</Fragment>')).to.equal('import { createFragment } from "inferno";\ncreateFragment(a, flag);');
    });
  });

  describe('$ReCreate', function () {
    var MESSAGE = '$ReCreate has been removed in Inferno 10. To re-create the element, change its key instead, for example key={version}.';

    it('Should throw for $ReCreate on elements and point at it', function () {
      expect(function () {
        transform('<div $ReCreate/>');
      }).to.throw('unknown file: ' + MESSAGE + '\n> 1 | <div $ReCreate/>\n    |      ^^^^^^^^^');
    });

    it('Should throw for $ReCreate on components', function () {
      expect(function () {
        transform('<Foo $ReCreate/>');
      }).to.throw(MESSAGE);
    });

    it('Should throw for $ReCreate on input and svg elements', function () {
      expect(function () {
        transform('<input $ReCreate/>');
      }).to.throw(MESSAGE);
      expect(function () {
        transform('<svg $ReCreate/>');
      }).to.throw(MESSAGE);
    });

    it('Should throw for $ReCreate on Fragments', function () {
      expect(function () {
        transform('<Fragment $ReCreate>{x}</Fragment>');
      }).to.throw(MESSAGE);
    });

    it('Should throw for $ReCreate on generic components', function () {
      expect(function () {
        transformTSX('<Foo<T> $ReCreate/>');
      }).to.throw(MESSAGE);
    });

    it('Should throw for $ReCreate whatever the uselessFlags option is', function () {
      expect(function () {
        helpers.transformWith({uselessFlags: 'off'}, '<div $ReCreate/>');
      }).to.throw(MESSAGE);
    });
  });

  describe('other combinations', function () {
    it('Should throw for $HasTextChildren without children', function () {
      expect(function () {
        transform('<div $HasTextChildren />');
      }).to.throw('$HasTextChildren needs one text child, but there are no children.');
    });

    it('Should ignore child flags on components', function () {
      expect(transform('<Foo $HasKeyedChildren>{a}</Foo>')).to.equal('newComponentVNode(0, Foo, {\n  children: a\n});');
    });

    it('Should keep $Flags with a spread', function () {
      expect(transform('<div $Flags={1} {...p}/>')).to.equal('normalizeProps(newVNode(17, "div", null, null, {\n  ...p\n}));');
    });

    it('Should keep $HasVNodeChildren with a spread', function () {
      expect(transform('<div {...p} $HasVNodeChildren>{a}</div>')).to.equal('normalizeProps(newVNode(9, "div", null, a, {\n  ...p\n}));');
    });

    it('Should drop $Flags on a Fragment', function () {
      expect(transform('<Fragment $Flags={1}>x</Fragment>')).to.equal('newFragment(260, [newTextVNode("x")]);');
    });
  });

  describe('current behaviour (questionable)', function () {
    it('Should add the ContentEditable flag to components', function () {
      expect(transform('<Foo contentEditable/>')).to.equal('newComponentVNode(131072, Foo, {\n  "contentEditable": true\n});');
    });

    it('Should throw for $HasTextChildren on several children', function () {
      expect(function () {
        transform('<div $HasTextChildren><a/><b/></div>');
      }).to.throw('$HasTextChildren needs one text child, but there are 2 children.');
    });

    it('Should pass a string $ChildFlag through as a string', function () {
      expect(transform('<div $ChildFlag="1">{a}</div>')).to.equal('createVNode(1, "div", null, a, "1");');
    });
  });
});
