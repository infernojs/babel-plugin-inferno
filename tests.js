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
		return pluginTransform(input).replace('import { createVNode } from "inferno";\n', '');
	}

	describe('Basic scenarios', function() {
		it('Should transform single div', function () {
			expect(pluginTransform('<div>1</div>')).to.equal('import { createVNode } from "inferno";\ncreateVNode(2, "div", null, "1");');
		});

		it('#Test to verify stripping imports work#', function () {
			expect(transform('<div>1</div>')).to.equal('createVNode(2, "div", null, "1");');
		});
	});
});

