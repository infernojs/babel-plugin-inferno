'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	<div hasKeyedChildren />
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
