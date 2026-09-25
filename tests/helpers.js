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

/*
 * Runs fn with console.warn replaced by a collector, so that the flag warnings of the plugin do not clutter the test
 * output. Returns {result, warnings}.
 */
function collectWarnings(fn) {
  var warn = console.warn;
  var warnings = [];

  console.warn = function (message) {
    warnings.push(message);
  };
  try {
    return {result: fn(), warnings: warnings};
  } finally {
    console.warn = warn;
  }
}

function babelTransformWarnings(pluginOptions, input, extraConfig) {
  return collectWarnings(function () {
    return babel.transformSync(input, Object.assign({
      babelrc: false,
      configFile: false,
      cwd: root,
      // Plain code frames in error messages, also when the tests run in a color terminal
      highlightCode: false,
      presets: [presetEnv],
      plugins: [
        [plugin, pluginOptions],
        '@babel/plugin-syntax-jsx'
      ]
    }, extraConfig));
  });
}

function babelTransform(pluginOptions, input, extraConfig) {
  return babelTransformWarnings(pluginOptions, input, extraConfig).result;
}

// Returns {code, warnings} with the messages the plugin passed to console.warn
function transformWarnings(input, pluginOptions, extraConfig) {
  var transformed = babelTransformWarnings(pluginOptions || {imports: true, defineAllArguments: false}, input, extraConfig);

  return {code: stripInfernoImport(transformed.result.code), warnings: transformed.warnings};
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

function transformTSXWarnings(input, pluginOptions, typescriptOptions) {
  return collectWarnings(function () {
    return babel.transformSync(input, {
      babelrc: false,
      configFile: false,
      cwd: root,
      highlightCode: false,
      filename: 'file.tsx',
      presets: [['@babel/preset-typescript', typescriptOptions || {}]],
      plugins: [[plugin, pluginOptions || {imports: true}]]
    }).code;
  });
}

function transformTSX(input, pluginOptions, typescriptOptions) {
  return transformTSXWarnings(input, pluginOptions, typescriptOptions).result;
}

function expectValidJS(code, sourceType) {
  expect(function () {
    babel.parseSync(code, {babelrc: false, configFile: false, sourceType: sourceType || 'module'});
  }).to.not.throw();
}

/*
 * Maps the first occurrence of `needle` in the generated code, moved right by `offset` columns, back to the input.
 * The offset lets a needle include text before a short token, e.g. ('"bar": x', 7) for the x.
 * Returns {line, column} (line 1-based, column 0-based) or {line: null, column: null} when unmapped.
 */
function originalPosition(result, needle, offset) {
  var lines = result.code.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var column = lines[i].indexOf(needle);

    if (column !== -1) {
      var position = traceMapping.originalPositionFor(new traceMapping.TraceMap(result.map), {line: i + 1, column: column + (offset || 0)});

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
  transformTSXWarnings: transformTSXWarnings,
  transformWarnings: transformWarnings,
  collectWarnings: collectWarnings,
  expectValidJS: expectValidJS,
  originalPosition: originalPosition
};
