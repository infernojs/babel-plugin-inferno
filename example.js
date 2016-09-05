'use strict';

const babel  = require('babel-core');
const plugin = require('./lib/index');

const code = `
	function render() {
		return (
			<div className="basic">
				<span checked={ true } className={ this.props.name }>The title is { this.props.title }</span>
			</div>
		);
	}
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
