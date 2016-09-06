'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	var a = <div className={ abc }>foo</div>
	var b = <div className={ abc }>foo</div>
	var c = <div>{ lol }</div>
	var c = <div>foo<div>foo</div></div>
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
