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

describe('Array', function() {

	function pluginTransform(input) {
		return babel.transform(input, babelSettings).code;
	}

	function transform(input) {
		return pluginTransform(input).replace('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\n', '');
	}

	describe('Dynamic children', function() {
		it('Should add normalize call when there is dynamic children', function () {
			expect(pluginTransform('<div>{a}</div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div", null, normalize(a));');
		});

		it('Should add normalize call when there is dynamic and static children mixed', function () {
			expect(pluginTransform('<div>{a}<div>1</div></div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div", null, normalize([a, createVNode(2, "div", null, "1")]));');
		});

		it('Should not add normalize call when all children are known', function () {
			expect(pluginTransform('<div><FooBar/><div>1</div></div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div", null, [createVNode(16, FooBar), createVNode(2, "div", null, "1")]);');
		});

		it('Should create textVNodes when there is no normalization needed and its not single children', function () {
			expect(pluginTransform('<div><FooBar/>foobar</div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div", null, [createVNode(16, FooBar), createTextVNode("foobar")]);');
		});

		it('Should not create textVNodes when there is single children', function () {
			expect(pluginTransform('<div>foobar</div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div", null, "foobar");');
		});

		it('Should not create textVNodes when there is single children', function () {
			expect(pluginTransform('<div>1</div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div", null, "1");');
		});

		it('Should normalize only Component prop children', function () {
			expect(pluginTransform('<Com>{a}</Com>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(16, Com, null, null, {\n  children: normalize(a)\n});');
		});

		it('Should not add children into array when specified in positions', function () {
			expect(pluginTransform('<Com>{a}{b}{c}</Com>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(16, Com, null, null, {\n  children: normalize([a, b, c])\n});');
		});
	});

	describe('spreadOperator', function () {
		it('Should add call to normalizeProps when spread operator is used', function () {
			expect(pluginTransform('<div {...props}>1</div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\nnormalizeProps(createVNode(2, "div", null, "1", {\n  ...props\n}));');
		});

		it('Should add call to normalizeProps when spread operator is used #2', function () {
			expect(pluginTransform('<div foo="bar" className="test" {...props}/>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\nnormalizeProps(createVNode(2, "div", "test", null, {\n  "foo": "bar",\n  ...props\n}));');
		});

		it('Should add call to normalizeProps when spread operator is used inside children for Component', function () {
			expect(pluginTransform('<FooBar><BarFoo {...props}/><NoNormalize/></FooBar>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(16, FooBar, null, null, {\n  children: [normalizeProps(createVNode(16, BarFoo, null, null, {\n    ...props\n  })), createVNode(16, NoNormalize)]\n});');
		});
	});

	describe('Basic scenarios', function() {
		it('Should transform div', function () {
			expect(pluginTransform('<div></div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div");');
		});

		it('Should transform single div', function () {
			expect(pluginTransform('<div>1</div>')).to.equal('import { normalizeProps, createTextVNode, normalize, createVNode } from "inferno";\ncreateVNode(2, "div", null, "1");');
		});

		it('#Test to verify stripping imports work#', function () {
			expect(transform('<div>1</div>')).to.equal('createVNode(2, "div", null, "1");');
		});

		it('className should be in third parameter as string when its element', function () {
			expect(transform('<div className="first second">1</div>')).to.equal('createVNode(2, "div", "first second", "1");');
		});

		it('className should be in fifth parameter as string when its component', function () {
			expect(transform('<UnkownClass className="first second">1</UnkownClass>')).to.equal('createVNode(16, UnkownClass, null, null, {\n  "className": "first second",\n  children: "1"\n});');
		});

		it('class should be in third parameter as variable', function () {
			expect(transform('<div class={variable}>1</div>')).to.equal('createVNode(2, "div", variable, "1");');
		});

		it('Events should be in props', function () {
			expect(transform('<div id="test" onClick={func} class={variable}>1</div>')).to.equal('createVNode(2, "div", variable, "1", {\n  "id": "test",\n  "onClick": func\n});');
		});

		it('Should transform input and htmlFor correctly', function () {
			var result = transform('<label htmlFor={id}><input id={id} name={name} value={value} onChange={onChange} onInput={onInput} onKeyup={onKeyup} onFocus={onFocus} onClick={onClick} type="number" pattern="[0-9]+([,\.][0-9]+)?" inputMode="numeric" min={minimum}/></label>');
			var expected = 'createVNode(2, "label", null, createVNode(512, "input", null, null, {\n  "id": id,\n  "name": name,\n  "value": value,\n  "onChange": onChange,\n  "onInput": onInput,\n  "onKeyup": onKeyup,\n  "onFocus": onFocus,\n  "onClick": onClick,\n  "type": "number",\n  "pattern": "[0-9]+([,.][0-9]+)?",\n  "inputMode": "numeric",\n  "min": minimum\n}), {\n  "for": id\n});';
			expect(result).to.equal(expected);
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
			expect(pluginTransformPragma('<div></div>')).to.equal('t.some(2, "div");');
		});
	});

	/**
	 * In Inferno all SVG attributes are written as in DOM standard
	 * however for compatibility reasons we want to support React like syntax
	 *
	 */
	describe('SVG attributes React syntax support', function() {
		it('Should transform xlinkHref to xlink:href', function () {
			expect(transform('<svg><use xlinkHref="#tester"></use></svg>')).to.equal('createVNode(128, "svg", null, createVNode(2, "use", null, null, {\n  "xlink:href": "#tester"\n}));');
		});

		it('Should transform strokeWidth to stroke-width', function () {
			expect(transform('<svg><rect strokeWidth="1px"></rect></svg>')).to.equal('createVNode(128, "svg", null, createVNode(2, "rect", null, null, {\n  "stroke-width": "1px"\n}));');
		});

		it('Should transform strokeWidth to stroke-width', function () {
			expect(transform('<svg><rect fillOpacity="1"></rect></svg>')).to.equal('createVNode(128, "svg", null, createVNode(2, "rect", null, null, {\n  "fill-opacity": "1"\n}));');
		});
	});
});

