'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
		function render() {
			return (
				<div style={ this.props.styles }>
					<span style={ this.props.styles }>The title is { this.props.title }</span>
				</div>
			);
		}
		render(<div class="Hello, World!"><span><div id={ attrs }>{ n }</div></span></div>, container);
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
