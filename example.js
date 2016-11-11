'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
render(<input type="text" ref={obj.fn} spellcheck="false"
									readOnly={bool ? 'readonly' : false} disabled={bool}
									ondragenter={test} ondragover={test} value={newValue} oninput={test}
									onclick={obj.click} class="edit-field" onkeydown={test} onkeyup={test}
									onBlur={test} {...spread} />, container);
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
