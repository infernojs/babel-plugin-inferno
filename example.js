'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	var a = <BasicComponent2 title="abc" name="basic-render">
				<span>Im a child</span>
			</BasicComponent2>
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: true, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
