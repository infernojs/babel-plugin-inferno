var path = require('path');
var babel = require('@babel/core');
var chai = require('chai');
var traceMapping = require('@jridgewell/trace-mapping');
var plugin = require('../lib/index.js');
var expect = chai.expect;

// Resolve presets and plugins from the repository root regardless of the working directory
var root = path.resolve(__dirname, '..');

process.env.BABEL_TYPES_8_BREAKING = true;

// Same preset as tests.js; keeps pinned outputs identical between the old and the new suites
var presetEnv = ['@babel/preset-env', {modules: false, targets: {browsers: 'last 1 Chrome versions'}}];

// Babel configs that can be passed as `extraConfig` to transformWith()
var es5 = {presets: [['@babel/preset-env', {modules: false, targets: 'ie 11'}]]};
var es5CommonJS = {presets: [['@babel/preset-env', {modules: 'commonjs', targets: 'ie 11'}]]};

function babelTransform(pluginOptions, input, extraConfig) {
  return babel.transformSync(input, Object.assign({
    babelrc: false,
    configFile: false,
    cwd: root,
    presets: [presetEnv],
    plugins: [
      [plugin, pluginOptions],
      '@babel/plugin-syntax-jsx'
    ]
  }, extraConfig));
}

function transformWith(pluginOptions, input, extraConfig) {
  return babelTransform(pluginOptions, input, extraConfig).code;
}

function pluginTransform(input) {
  return transformWith({imports: true, defineAllArguments: false}, input);
}

function stripInfernoImport(code) {
  return code.replace(new RegExp('import.*"inferno";\\n'), '');
}

function transform(input) {
  return stripInfernoImport(pluginTransform(input));
}

function transformTSX(input, pluginOptions, typescriptOptions) {
  return babel.transformSync(input, {
    babelrc: false,
    configFile: false,
    cwd: root,
    filename: 'file.tsx',
    presets: [['@babel/preset-typescript', typescriptOptions || {}]],
    plugins: [[plugin, pluginOptions || {imports: true}]]
  }).code;
}

function expectValidJS(code, sourceType) {
  expect(function () {
    babel.parseSync(code, {babelrc: false, configFile: false, sourceType: sourceType || 'module'});
  }).to.not.throw();
}

/*
 * Maps the first occurrence of `needle` in the generated code back to the input.
 * Returns {line, column} (line 1-based, column 0-based) or {line: null, column: null} when unmapped.
 */
function originalPosition(result, needle) {
  var lines = result.code.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var column = lines[i].indexOf(needle);

    if (column !== -1) {
      var position = traceMapping.originalPositionFor(new traceMapping.TraceMap(result.map), {line: i + 1, column: column});

      return {line: position.line, column: position.column};
    }
  }
  throw new Error('"' + needle + '" not found in generated code:\n' + result.code);
}

module.exports = {
  babel: babel,
  plugin: plugin,
  es5: es5,
  es5CommonJS: es5CommonJS,
  babelTransform: babelTransform,
  transformWith: transformWith,
  pluginTransform: pluginTransform,
  stripInfernoImport: stripInfernoImport,
  transform: transform,
  transformTSX: transformTSX,
  expectValidJS: expectValidJS,
  originalPosition: originalPosition
};
