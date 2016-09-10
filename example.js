'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	var a = <div>
		<div>
		{ foo }
		</div>
		{ null }
		<div>
		</div>
	</div>
	var b = <div><div /></div>
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
