'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	<div><div><div></div></div></div>
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
