'use strict';

const babel = require('babel-core');
const plugin = require('./lib');

const code = `
				const children = [
					<B key="b"></B>,
					<div key="a">ROW</div>
				];
`;

console.log(
  babel.transform(code, {
    presets: ['es2015'],
    plugins: [
      [plugin, {inline: false, preclone: true}],
      'syntax-jsx'
    ]
  }).code
);
