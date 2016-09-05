'use strict';

const babel  = require('babel-core');
const plugin = require('./lib/index');

const code = `
		<Router url={ url } history={ browserHistory }>
			<Route path={ path } component={ component } />
		</Router>
`;

const output = babel.transform(code, {
	plugins: [ plugin, 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
