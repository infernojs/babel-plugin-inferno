"use strict";

var babel  = require("babel-core");
var plugin = require("./lib/index");

var code = `
    var foo = require("test");

    var someObj = {
        render() {
            return (
                <div><div><span>{ test || foo }</span></div><h1>Hello world!</h1></div>
            );
        }
    }
`;

var output = babel.transform(code, {
    plugins: [plugin, 'syntax-jsx'],
    presets: ['es2015']
}).code;

console.log(output);

var code = `
    var someObj = {
        render() {
            return <div><span>{ test || foo }</span>{ bar } { foo }</div>
        }
    }
`;

var output = babel.transform(code, {
    plugins: [plugin, 'syntax-jsx'],
    presets: ['es2015']
}).code;

var code = `
    var foo = require("test");

    var someObj = {
        render() {
            return (
                <div test1={ foo1 }
                    test2={ "test" }
                    test3={ foo.bind(this) }
                    test4={ () => "lol" }
                    test5="123"
                    test6={ too\`bar\` }
                ><Foo
                    test1={ a ? 1 : 2 }
                    test2={ [1,2,3] }
                    test3={ {"bar": foo2} }
                    test4={ \`test\` }
                    test5={ 1 + 1 }
                    test6={ \`foo$\{ fooBar \}\` }></Foo
                ></div>
            );
        }
    }
`;

var output = babel.transform(code, {
    plugins: [plugin, 'syntax-jsx'],
    presets: ['es2015']
}).code;

console.log(output);
