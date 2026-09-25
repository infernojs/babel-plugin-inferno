<p align="center"><a href="https://infernojs.org/" target="_blank"><img width="400" alt="Inferno" title="Inferno" src="https://user-images.githubusercontent.com/2021355/36073166-a47d4a8e-0f34-11e8-959c-860ea836d79d.png"></p>

<p align="center">
  <a href="https://www.npmjs.com/package/babel-plugin-inferno"><img src="https://img.shields.io/npm/dm/babel-plugin-inferno.svg" alt="Downloads"></a>
  <a href="https://www.npmjs.com/package/babel-plugin-inferno"><img src="https://img.shields.io/npm/v/babel-plugin-inferno.svg" alt="Version"></a>
  <a href="https://www.npmjs.com/package/babel-plugin-inferno"><img src="https://img.shields.io/npm/l/babel-plugin-inferno.svg" alt="License"></a>
</p>

# InfernoJS Babel Plugin

> Plugin for babel 6+ to enable JSX for Inferno

This plugin transforms JSX code in your projects to [Inferno](https://github.com/trueadm/inferno) compatible virtual DOM.
It is recommended to use this plugin for compiling JSX for inferno. It is different to other JSX plugins, because it outputs highly optimized inferno specific `createVNode` calls. This plugin also checks children shape during compilation stage to reduce overhead from runtime application. 

## How to install

```bash
npm i --save-dev babel-plugin-inferno
```

## How to use

Add the plugin to your `package.json` and update the plugin section in your `.babelrc` file. Or if your Babel settings are located inside the `package.json` - update the plugin section there.

It's important that you also include the `babel-plugin-syntax-jsx`plugin.

Example on a `.babelrc` file that will work with Inferno:

Make sure inferno plugin is added before babel module transformers

```js
{   
    "presets": [ "es2015" ],
    "plugins": [["babel-plugin-inferno", {"imports": true}]]
}
```

## Examples    

```js

// Render a simple div
Inferno.render(<div></div>, container);

// Render a div with text
Inferno.render(<div>Hello world</div>, container);

// Render a div with a boolean attribute
Inferno.render(<div autoFocus='true' />, container);

```

## Fragments

All of the following syntaxes are **reserved** for createFragment call

```js
<>
    <div>Foo</div>
    <div>Bar</div>
</>


<Fragment>
    <div>Foo</div>
    <div>Bar</div>
</Fragment>

<Inferno.Fragment>
    <div>Foo</div>
    <div>Bar</div>
</Inferno.Fragment>

```

React.Fragment is also compiled to inferno createFragment call to ease project migration to Inferno https://github.com/infernojs/babel-plugin-inferno/issues/56.

## Special flags

This plugin provides few special compile time flags that can be used to optimize an inferno application.

```js
// ChildFlags:
<div $HasTextChildren /> - Children is rendered as pure text
<div $HasVNodeChildren /> - Children is another vNode (Element or Component)
<div $HasNonKeyedChildren /> - Children is always array without keys
<div $HasKeyedChildren /> - Children is array of vNodes having unique keys
<div $ChildFlag={expression} /> - This attribute is used for defining children shpae runtime. See inferno-vnode-flags (ChildFlags) for possibe values

// Functional flags
<div $ReCreate /> - This flag tells inferno to always remove and add the node. It can be used to replace key={Math.random()}
```

Flag called `noNormalize` has been removed in v4, and is replaced by `$HasVNodeChildren`

## Options


Change in v4:


#### Imports (boolean)
babel-plugin-inferno will automatically import the required methods from inferno library.
There is no need to import inferno in every single JSX file. Only import the inferno specific code required by the application.

example:
```js
import {render} from 'inferno'; // Just import what you need, (render in this case)

// The plugin will automatically import, createVNode
render(<div>1</div>, document.getElementById('root'));
```

You need to have support for ES6 modules for this to work. If you are using legacy build system or outdated version of webpack, you can revert this change by using `imports: false`

```js
{
    "presets": [ "es2015" ],
    "plugins": [["inferno", {
        "imports": false
    }]]
}
```


#### Pragma

Each method that is used from inferno can be replaced by custom name.

``` pragma ``` (string) defaults to createVNode.

``` pragmaCreateComponentVNode ``` (string) defaults to createComponentVNode.
 
``` pragmaNormalizeProps ``` (string) defaults to normalizeProps.
 
``` pragmaTextVNode ``` (string) defaults to createTextVNode.

``` pragmaFragmentVNode ``` (string) defaults to createFragment.
 

```js
{
    "presets": [ "es2015" ],
    "plugins": [["inferno", {
        "imports": true,
        "pragma": "",
        "pragmaCreateComponentVNode": "",
        "pragmaNormalizeProps": "",
        "pragmaTextVNode": ""
    }]]
}
```

### Troubleshoot

You can verify `babel-plugin-inferno` is used by looking at the compiled output.
This plugin does not generate calls to `createElement` or `h`, but instead it uses low level InfernoJS API
`createVNode`, `createComponentVNode`, `createFragment` etc. If you see your JSX being transpiled into `createElement` calls
its good indication that your babel configuration is not correct.

## Benchmarks

`bench/` measures how much time and memory the plugin itself costs, separated from what Babel costs anyway.
It has no dependencies beyond the ones the tests use.

```bash
npm run bench            # every case, about 4 minutes
npm run bench:quick      # shorter runs, without the largest case
npm run bench:compare    # working tree against HEAD; pass another ref with -- --baseline <ref>
npm run bench:profile    # CPU and allocation profile of the plugin functions (case mixed-M)
node bench/run.js --help # filters, plugin options, rounds, output file
```

The cases are hand-written components in `bench/fixtures/` (a TodoMVC app, a dashboard, an SVG icon set, an article
and a TSX form) and generated modules from `bench/generate.js`: random but seeded component trees of 200, 2,000 and
20,000 JSX nodes (`mixed-S/M/L`), a list of 2,000 keyed children (`wide-M`) and elements nested 200 deep (`deep-M`).

Each case runs in fresh processes, and prints:

| column | meaning |
| --- | --- |
| `e2e ms`, `e2e MB` | `transformSync` of the file with only this plugin (and `preset-typescript` for `.tsx`): parse, transform and generate |
| `gc/op` | garbage collections per `transformSync` |
| `plugin ms`, `plugin MB` | the plugin's own cost: Babel's transform of a pre-parsed AST with the plugin, minus the same without any plugin, without code generation |
| `±` | 95% margin of error of the median |
| `µs/node`, `KB/node` | plugin cost per JSX element or fragment; similar values for `mixed-S/M/L` mean the cost grows linearly |
| `share` | `plugin ms / e2e ms` |
| `leak` | heap growth after repeated runs, which would point to state kept between files |

Allocations are counted with `v8.getHeapStatistics().total_allocated_bytes`, in a process that runs without V8's
optimizing compilers and with a large young generation. That makes the count repeat to about 1% between runs, but it
counts what the code allocates before escape analysis removes some of it, so optimized code allocates less.
The results of every run are written to `bench/results/` as JSON.

Timings on a laptop or desktop vary by several percent between runs. Prefer the allocation columns for small
changes, compare with `bench:compare` rather than with an older printout, and keep the machine idle. On Linux, the
`performance` CPU governor and pinning to one core reduce the noise further:
`sudo cpupower frequency-set -g performance` and `taskset -c 2 npm run bench`.

In compare mode a change marked `~` is within the noise: the rounds disagree on its direction, or it is smaller
than 1% or than the margin of error.
