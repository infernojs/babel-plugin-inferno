'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
	// const foo = <div ref={ () => foo }>Test</div>
	const foo2 = <Component ref={ () => foo }><div /></Component>
	const foo3 = <Component2 {...foo} {...bar} />
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
