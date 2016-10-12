'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
export default (
  <div>
    <img src="FOO_URL"/><Component>Foo</Component>
    <img src="BAR_URL"/><Component>Bar</Component>
  </div>
);
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
