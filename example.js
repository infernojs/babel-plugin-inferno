'use strict';

const babel = require('babel-core');
const plugin = require('./lib');

const code = `
function foo() {
  return (
    <div className='MessagesPost'>
      {/*
        This component is a placeholder. According to our API, we sometimes get
        posts back when fetching messages. This component is a stub for that.
      */}
    </div>
  );
  }
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
