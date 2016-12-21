'use strict';

const babel = require('babel-core');
const plugin = require('./lib');

const code = `
<div>Hello world, { ['Foo! ', 'Bar!'] }</div>
`;

console.log(
  babel.transform(code, {
    presets: ['es2015'],
    plugins: [
      [plugin],
      'syntax-jsx'
    ]
  }).code
);
