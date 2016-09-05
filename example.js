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
		render((
			<BasicComponent3 title="styled!" styles={ { color: 'red', paddingLeft: '10px' } } />
		), container);

		render((
			<BasicComponent3 />
		), container);

		render((
			<BasicComponent3 title="styled (again)!" styles={ { color: 'blue', marginBottom: '20px' } } />
		), container);
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
