'use strict';

var babel = require('babel-core');

var plugin = require('./lib');

var code = `
<div>
    <span key="1">Hello</span>
    <div>
        Another
        <div>foo</div>    
    </div>
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
