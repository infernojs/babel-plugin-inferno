'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	// const foo = <div ref={ () => foo }>Test</div>
	const foo2 = <Component ref={ () => foo }><div />{ foo }</Component>
	const foo3 = <Component2 {...foo} {...bar} />
	const foo4 = <div data-foo="bar">The title is {this.props.title}</div>
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
