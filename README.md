# InfernoJS Babel Plugin

> Plugin for babel 6.x to enable JSX for Inferno

This plugin transforms JSX code in your projects to [Inferno](https://github.com/trueadm/inferno) compatible virtual DOM. 

## How to install

If using Inferno with version `1.0.0-beta37`:
```bash
npm i --save-dev babel-plugin-inferno@beta17
```

If using Inferno with version `0.7`:
```bash
npm i --save-dev babel-plugin-inferno@1.0.0-legacy
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
