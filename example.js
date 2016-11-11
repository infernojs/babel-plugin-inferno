'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	render(<StatelessComponent onComponentWillMount={spyObj.fn}/>, _container);
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
