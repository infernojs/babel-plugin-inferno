'use strict';

const babel  = require('babel-core');
const plugin = require('./lib/index');

const code = `
	function render() {
		const props = {
			onBlur : this.handleBlur,
			className: 'foo',
			id: 'test'
		};

		return (<input { ...props } ></input>);
	}
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
