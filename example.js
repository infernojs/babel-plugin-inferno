'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

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

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
