var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var chai = require('chai');
var plugin = require('./lib/index.js');
var expect = chai.expect;
var babel = require('babel-core');
var babelSettings = {
    presets: [['es2015', {modules: false}]],
    plugins: [
        [plugin, {imports: true}],
        'syntax-jsx'
    ]
};

describe('Transforms', function () {

    function pluginTransform(input) {
        return babel.transform(input, babelSettings).code;
    }

    function transform(input) {
        return pluginTransform(input).replace(new RegExp('import.*"inferno";\\n'), '');
    }

    describe('Dynamic children', function () {
        it('Should add normalize call when there is dynamic children', function () {
            expect(transform('<div>{a}</div>')).to.equal('createVNode(1, "div", null, a, 0);');
        });

        it('Should add normalize call when there is dynamic and static children mixed', function () {
            expect(transform('<div>{a}<div>1</div></div>')).to.equal('createVNode(1, "div", null, [a, createVNode(1, "div", null, createTextVNode("1"), 2)], 0);');
        });

        it('Should not add normalize call when all children are known', function () {
            expect(transform('<div><FooBar/><div>1</div></div>')).to.equal('createVNode(1, "div", null, [createComponentVNode(2, FooBar), createVNode(1, "div", null, createTextVNode("1"), 2)], 4);');
        });

        it('Should create textVNodes when there is no normalization needed and its multiple children', function () {
            expect(transform('<div><FooBar/>foobar</div>')).to.equal('createVNode(1, "div", null, [createComponentVNode(2, FooBar), createTextVNode("foobar")], 4);');
        });

        it('Should create textVNodes when there is single children', function () {
            expect(transform('<div>foobar</div>')).to.equal('createVNode(1, "div", null, createTextVNode("foobar"), 2);');
        });

        it('Should create textVNodes when there is single children', function () {
            expect(transform('<div>1</div>')).to.equal('createVNode(1, "div", null, createTextVNode("1"), 2);');
        });

        it('Should not normalize Component prop children', function () {
            expect(transform('<Com>{a}</Com>')).to.equal('createComponentVNode(2, Com, {\n  children: a\n});');
        });

        it('Should not normalize component children as they are in props', function () {
            expect(transform('<Com>{a}{b}{c}</Com>')).to.equal('createComponentVNode(2, Com, {\n  children: [a, b, c]\n});');
        });

        it('Should mark parent vNode with $HasNonKeyedChildren if no normalize is needed and all children are non keyed', function () {
            expect(transform('<div><FooBar/><div>1</div></div>')).to.equal('createVNode(1, "div", null, [createComponentVNode(2, FooBar), createVNode(1, "div", null, createTextVNode("1"), 2)], 4);');
        });

        it('Should mark parent vNode with $HasKeyedChildren if no normalize is needed and all children are keyed', function () {
            expect(transform('<div><FooBar key="foo"/><div key="1">1</div></div>')).to.equal('createVNode(1, "div", null, [createComponentVNode(2, FooBar, null, "foo"), createVNode(1, "div", null, createTextVNode("1"), 2, null, "1")], 8);');
        });
    });

    describe('deprecations', function () {
        it('Should warn if noNormalize/hasKeyedChildren/hasNonKeyedChildren is used', function () {
            expect(function () {
                transform('<span><div noNormalize/></span>')
            }).to.throw('unknown: Inferno JSX plugin:\nnoNormalize is deprecated use: $HasVNodeChildren, or if children shape is dynamic you can use: $ChildFlag={expression} see inferno package:inferno-vnode-flags (ChildFlags) for possible values');

            expect(function () {
                transform('<span><div $NoNormalize/></span>')
            }).to.throw('unknown: Inferno JSX plugin:\n$NoNormalize is deprecated use: $HasVNodeChildren, or if children shape is dynamic you can use: $ChildFlag={expression} see inferno package:inferno-vnode-flags (ChildFlags) for possible values');

            expect(function () {
                transform('<span><div hasKeyedChildren/></span>')
            }).to.throw('unknown: Inferno JSX plugin:\nhasKeyedChildren is deprecated use: $HasKeyedChildren');

            expect(function () {
                transform('<span><div hasNonKeyedChildren/></span>')
            }).to.throw('unknown: Inferno JSX plugin:\nhasNonKeyedChildren is deprecated use: $HasNonKeyedChildren');
        })
    });

    describe('Dynamic ChildFlags', function () {
        it('Should be possible to define override childFlags runtime for dynamic children', function () {
            expect(transform('<img $ChildFlag={bool ? 1 : 2}>{expression}</img>')).to.equal('createVNode(1, "img", null, expression, bool ? 1 : 2);');
        });

        it('Should be possible to define override childFlags runtime', function () {
            expect(transform('<img $ChildFlag={1}>foobar</img>')).to.equal('createVNode(1, "img", null, createTextVNode("foobar"), 1);');
        });

        it('Should be possible to use expression for childFlags', function () {
            expect(transform('<img $ChildFlag={magic}>foobar</img>')).to.equal('createVNode(1, "img", null, createTextVNode("foobar"), magic);');
        });
    });

    describe('different types', function () {
        it('Should transform img', function () {
            expect(transform('<img>foobar</img>')).to.equal('createVNode(1, "img", null, createTextVNode("foobar"), 2);');
        });

        it('Should transform br', function () {
            expect(transform('<br>foobar</br>')).to.equal('createVNode(1, "br", null, createTextVNode("foobar"), 2);');
        });

        it('Should transform media', function () {
            expect(transform('<media>foobar</media>')).to.equal('createVNode(1, "media", null, createTextVNode("foobar"), 2);');
        });

        it('Should transform textarea', function () {
            expect(transform('<textarea>foobar</textarea>')).to.equal('createVNode(128, "textarea", null, createTextVNode("foobar"), 2);');
        });
    });

    describe('Special flags', function () {
        it('Should add keyed children flag', function () {
            expect(transform('<div $HasKeyedChildren>{magic}</div>')).to.equal('createVNode(1, "div", null, magic, 8);');
        });

        it('Should not normalize if noNormalize set', function () {
            expect(transform('<div $HasVNodeChildren>{magic}</div>')).to.equal('createVNode(1, "div", null, magic, 2);');
        });

        it('Should createTextVNode (when string is hardcoded) regardless if noNormalize set', function () {
            expect(transform('<div $HasVNodeChildren>text</div>')).to.equal('createVNode(1, "div", null, createTextVNode("text"), 2);');
        });

        it('Should add non keyed children flag', function () {
            expect(transform('<div $HasNonKeyedChildren>{test}</div>')).to.equal('createVNode(1, "div", null, test, 4);');
        });

        // it('Should add ignore flag', function () {
        // 	expect(transform('<div $Ignore/>')).to.equal('createVNode(8193, "div");');
        // });

        it('Should add re create flag', function () {
            expect(transform('<div $ReCreate/>')).to.equal('createVNode(2049, "div");');
        });
    });

    describe('spreadOperator', function () {
        it('Should add call to normalizeProps when spread operator is used', function () {
            expect(transform('<div {...props}>1</div>')).to.equal('normalizeProps(createVNode(1, "div", null, createTextVNode("1"), 2, {\n  ...props\n}));');
        });

        it('Should add call to normalizeProps when spread operator is used #2', function () {
            expect(transform('<div foo="bar" className="test" {...props}/>')).to.equal('normalizeProps(createVNode(1, "div", "test", null, 1, {\n  "foo": "bar",\n  ...props\n}));');
        });

        it('Should add call to normalizeProps when spread operator is used inside children for Component', function () {
            expect(transform('<FooBar><BarFoo {...props}/><NoNormalize/></FooBar>')).to.equal('createComponentVNode(2, FooBar, {\n  children: [normalizeProps(createComponentVNode(2, BarFoo, {\n    ...props\n  })), createComponentVNode(2, NoNormalize)]\n});');
        });

        it('Should do single normalization when multiple spread operators are used', function () {
            expect(transform('<FooBar><BarFoo {...magics} {...foobars} {...props}/><NoNormalize/></FooBar>')).to.equal('createComponentVNode(2, FooBar, {\n  children: [normalizeProps(createComponentVNode(2, BarFoo, {\n    ...magics,\n    ...foobars,\n    ...props\n  })), createComponentVNode(2, NoNormalize)]\n});');
        });
    });

    describe('Basic scenarios', function () {
        it('Should transform div', function () {
            expect(transform('<div></div>')).to.equal('createVNode(1, "div");');
        });

        it('Should transform single div', function () {
            expect(transform('<div>1</div>')).to.equal('createVNode(1, "div", null, createTextVNode("1"), 2);');
        });

        it('#Test to verify stripping imports work#', function () {
            expect(transform('<div>1</div>')).to.equal('createVNode(1, "div", null, createTextVNode("1"), 2);');
        });

        it('className should be in third parameter as string when its element', function () {
            expect(transform('<div className="first second">1</div>')).to.equal('createVNode(1, "div", "first second", createTextVNode("1"), 2);');
        });

        it('className should be in fifth parameter as string when its component', function () {
            expect(transform('<UnknownClass className="first second">1</UnknownClass>')).to.equal('createComponentVNode(2, UnknownClass, {\n  "className": "first second",\n  children: "1"\n});');
        });

        it('JSXMemberExpressions should work', function () {
            expect(transform('<Components.Unknown>1</Components.Unknown>')).to.equal('createComponentVNode(2, Components.Unknown, {\n  children: "1"\n});');
        });

        it('class should be in third parameter as variable', function () {
            expect(transform('<div class={variable}>1</div>')).to.equal('createVNode(1, "div", variable, createTextVNode("1"), 2);');
        });

        it('Should call createVNode twice and createTextVNode once', function () {
            expect(transform(`<div>
          <div>single</div>
        </div>`)).to.equal('createVNode(1, "div", null, createVNode(1, "div", null, createTextVNode("single"), 2), 2);');
        });

        it('Events should be in props', function () {
            expect(transform('<div id="test" onClick={func} class={variable}>1</div>')).to.equal('createVNode(1, "div", variable, createTextVNode("1"), 2, {\n  "id": "test",\n  "onClick": func\n});');
        });

        it('Should transform input and htmlFor correctly', function () {
            var result = transform('<label htmlFor={id}><input id={id} name={name} value={value} onChange={onChange} onInput={onInput} onKeyup={onKeyup} onFocus={onFocus} onClick={onClick} type="number" pattern="[0-9]+([,\.][0-9]+)?" inputMode="numeric" min={minimum}/></label>');
            var expected = 'createVNode(1, "label", null, createVNode(64, "input", null, null, 1, {\n  "id": id,\n  "name": name,\n  "value": value,\n  "onChange": onChange,\n  "onInput": onInput,\n  "onKeyup": onKeyup,\n  "onFocus": onFocus,\n  "onClick": onClick,\n  "type": "number",\n  "pattern": "[0-9]+([,.][0-9]+)?",\n  "inputMode": "numeric",\n  "min": minimum\n}), 2, {\n  "for": id\n});';
            expect(result).to.equal(expected);
        });

        it('Should transform onDoubleClick to native html event', function () {
            expect(transform('<div onDoubleClick={foobar}></div>')).to.eql('createVNode(1, "div", null, null, 1, {\n  "onDblClick": foobar\n});');
        });
    });

    describe('Pragma option', function () {
        var babelSettingsPragma = {
            presets: [['es2015', {modules: false}]],
            plugins: [
                [plugin, {pragma: 't.some', imports: false}],
                'syntax-jsx'
            ]
        };

        function pluginTransformPragma(input) {
            return babel.transform(input, babelSettingsPragma).code;
        }

        it('Should replace createVNode to pragma option value', function () {
            expect(pluginTransformPragma('<div></div>')).to.equal('t.some(1, "div");');
        });
    });

    /**
     * In Inferno all SVG attributes are written as in DOM standard
     * however for compatibility reasons we want to support React like syntax
     *
     */
    describe('SVG attributes React syntax support', function () {
        it('Should transform xlinkHref to xlink:href', function () {
            expect(transform('<svg><use xlinkHref="#tester"></use></svg>')).to.equal('createVNode(32, "svg", null, createVNode(1, "use", null, null, 1, {\n  "xlink:href": "#tester"\n}), 2);');
        });

        it('Should transform strokeWidth to stroke-width', function () {
            expect(transform('<svg><rect strokeWidth="1px"></rect></svg>')).to.equal('createVNode(32, "svg", null, createVNode(1, "rect", null, null, 1, {\n  "stroke-width": "1px"\n}), 2);');
        });

        it('Should transform strokeWidth to stroke-width', function () {
            expect(transform('<svg><rect fillOpacity="1"></rect></svg>')).to.equal('createVNode(32, "svg", null, createVNode(1, "rect", null, null, 1, {\n  "fill-opacity": "1"\n}), 2);');
        });
    });

    describe('Imports', function () {
        it('Should not fail if createVNode is already imported', function () {
            expect(pluginTransform('import {createVNode} from "inferno"; var foo = <div/>;')).to.equal('import { createVNode } from "inferno";var foo = createVNode(1, "div");');
        });

        it('Should add import to createVNodeComponent but not to createVNode if createVNode is already delcared', function () {
            expect(pluginTransform('import {createVNode} from "inferno"; var foo = <FooBar/>;')).to.equal('import { createComponentVNode } from "inferno";\nimport { createVNode } from "inferno";var foo = createComponentVNode(2, FooBar);');
        });
    });

    describe('Children', function () {
        it('Element Should prefer child element over children props', function () {
            expect(transform('<div children="ab">test</div>')).to.eql('createVNode(1, "div", null, createTextVNode("test"), 2);');
        });

        it('Element Should prefer prop over empty children', function () {
            expect(transform('<div children="ab"></div>')).to.eql('createVNode(1, "div", null, createTextVNode("ab"), 2);');
        });

        it('Element Should use prop if no children exists', function () {
            expect(transform('<div children="ab"/>')).to.eql('createVNode(1, "div", null, createTextVNode("ab"), 2);');
        });


        it('Component Should prefer child element over children props', function () {
            expect(transform('<Com children="ab">test</Com>')).to.eql('createComponentVNode(2, Com, {\n  children: "test"\n});');
        });

        it('Component Should prefer prop over empty children', function () {
            expect(transform('<Com children="ab"></Com>')).to.eql('createComponentVNode(2, Com, {\n  "children": "ab"\n});');
        });

        it('Component Should use prop if no children exists', function () {
            expect(transform('<Com children="ab"/>')).to.eql('createComponentVNode(2, Com, {\n  "children": "ab"\n});');
        });

        it('Component Array empty children', function () {
            expect(transform('<Com>{[]}</Com>')).to.eql('createComponentVNode(2, Com);');
        });

        it('Component should create vNode for children', function () {
            expect(transform('<Com children={<div>1</div>}/>')).to.eql('createComponentVNode(2, Com, {\n  "children": createVNode(1, "div", null, createTextVNode("1"), 2)\n});');
        });

        it('Should prefer xml children over props', function () {
            expect(transform('<foo children={<span>b</span>}></foo>')).to.eql('createVNode(1, "foo", null, createVNode(1, "span", null, createTextVNode("b"), 2), 2);')
        });

        it('Should prefer xml children over props (null)', function () {
            expect(transform('<foo children={null}></foo>')).to.eql('createVNode(1, "foo");')
        });
    });
});

