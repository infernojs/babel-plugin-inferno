'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	var a = <div className={ abc } data-ticket-index={ lol }>foo</div>
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
