'use strict';

const babel = require('babel-core');
const plugin = require('./lib');

const code = `
      const foo = <div>
        <p>
          This should have
          no new lines in it
          or spaces at start
          and end
        </p>
        <div>{ ['1 space after this '] }</div>
      </div>

      const foo2 = <div>
        <p>
          This should have
          no new lines in it
          or spaces at start
          and end
        </p>
        <div>{ ['1 space after this '] }</div>
      </div>
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
