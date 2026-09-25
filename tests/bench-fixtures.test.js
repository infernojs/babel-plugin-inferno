// Keeps the benchmark corpus compiling; a fixture that throws would silently drop out of the measurements
var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var cases = require('../bench/cases');
var helpers = require('./helpers');
var transformWith = helpers.transformWith;
var transformTSX = helpers.transformTSX;
var expectValidJS = helpers.expectValidJS;

// The medium and large generated cases only repeat what these cover, at a size that would slow the suite down
var SKIPPED = ['mixed-M', 'mixed-L'];

describe('Benchmark fixtures', function () {
  cases.names().filter(function (name) {
    return SKIPPED.indexOf(name) === -1;
  }).forEach(function (name) {
    it('Should compile ' + name + ' without JSX left over', function () {
      var fixture = cases.load(name);
      var code = /\.tsx$/.test(fixture.filename)
        ? transformTSX(fixture.source, {imports: true})
        : transformWith({imports: true}, fixture.source, {filename: fixture.filename});

      // Parsing without the JSX and TypeScript syntax plugins fails on any JSX or type annotation that is left
      expectValidJS(code);
    });
  });
});
