# InfernoJS Babel Plugin

> Plugin for babel 6.x to enable JSX for Inferno


This plugin transforms JSX code in your projects to [Inferno](https://github.com/trueadm/inferno) fragments and templates. 

**Note!* This plugin has been built for use in Babel 6.x environments, and will not work with Babel 5.x ( *deprecated*) or older versions.

## How to install and use

Add the plugin to your `package.json` and update the plugin section in your `.babelrc` file. Or if your Babel settings are located inside the package.json` - update the plugin section there.

It's important that you also include the `babel-plugin-syntax-jsx`plugin.

Example on a `.babelrc` file that will work with Inferno:


```js
{   
     "presets": [ "es2015", "stage-0" ]
     "plugins": ["babel-plugin-syntax-jsx", "babel-plugin-inferno"]
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
