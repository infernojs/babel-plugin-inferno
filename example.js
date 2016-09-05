'use strict';

const babel  = require('babel-core');
const plugin = require('./lib/index');

const code = `
	function render() {
			return (
				<div ref={obj.fn}>Hello world2</div>
			);
	}
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
