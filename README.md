# InfernoJS Babel Plugin

> Plugin for babel 6.x to enable JSX for Inferno

This plugin transforms JSX code in your projects to [Inferno](https://github.com/trueadm/inferno) compatible virtual DOM. 

## How to install

```bash
npm i --save-dev babel-plugin-inferno
```

## How to use

Add the plugin to your `package.json` and update the plugin section in your `.babelrc` file. Or if your Babel settings are located inside the `package.json` - update the plugin section there.

It's important that you also include the `babel-plugin-syntax-jsx`plugin.

Example on a `.babelrc` file that will work with Inferno:


```js
{   
    "presets": [ "es2015" ],
    "plugins": ["inferno"]
}
```

## Examples    

```js

// Render a simple div
InfernoDOM.render(<div></div>, container); 

// Render a div with text
InfernoDOM.render(<div>Hello world</div>, container); 

// Render a div with a boolean attribute
InfernoDOM.render(<div autoFocus='true' />, container);

```

## Options

By default babel-plugin-inferno ships imports false. This is same behavior with ReactJS. You need to have Inferno declared in every JSX file. Even if not used by the code. Compiled code will have reference to global Inferno object.

If the environment supports modules (Webpack / Rollup) you can enable "imports" option which will import createVNode from Inferno. This allows tree-shaking to happen and Inferno does not need to be imported if not needed by the user land code.

Setting imports true can be done following way inside babelrc file

```js
{
    "presets": [ "es2015" ],
    "plugins": [["inferno", {"imports": true}]]
}
```
