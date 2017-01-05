'use strict';

const babel = require('babel-core');

const plugin = require('./lib');

const code = `
<div>
    <span>Hello</span>
    <div>Another</div>
</div>
`;

console.log(
  babel.transform(code, {
    presets: [['es2015', {modules: false}]],
    plugins: [
      [plugin],
      'syntax-jsx'
    ]
  }).code
);
