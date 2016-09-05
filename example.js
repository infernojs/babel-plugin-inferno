'use strict';

const babel  = require('babel-core');
const plugin = require('./lib/index');

const code = `
	function render() {
			return (
				<ul class="login-organizationlist">
					{ () => {} }
				</ul>
			);
	}
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
