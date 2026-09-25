// Table-driven tests for lib/lowerCaseAttributes.js, lib/attrsSVG.js and lib/attributeTransforms.js.
// Every table entry gets its own test, so a change to a table shows up as a named test change.
// The camelCase list was cross-checked against Preact's src/dom.d.ts and the SVG spec.
var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;
var lowerCaseAttributes = require('../lib/lowerCaseAttributes.js');
var svgAttributes = require('../lib/attrsSVG.js');
var attributeTransforms = require('../lib/attributeTransforms.js');

function elementProps(flags, tag, name) {
  return 'createVNode(' + flags + ', "' + tag + '", null, null, 1, {\n  "' + name + '": "v"\n});';
}

function componentProps(name) {
  return 'createComponentVNode(2, Foo, {\n  "' + name + '": "v"\n});';
}

// Case-sensitive SVG attributes that must reach the DOM in camelCase.
// lengthAdjust, xChannelSelector and yChannelSelector belong here too; see known-bugs/attribute-mapping.test.js
var svgCamelCaseAttributes = [
  'attributeName', 'attributeType', 'baseFrequency', 'baseProfile', 'calcMode', 'clipPathUnits',
  'diffuseConstant', 'edgeMode', 'filterUnits', 'glyphRef', 'gradientTransform', 'gradientUnits',
  'kernelMatrix', 'kernelUnitLength', 'keyPoints', 'keySplines', 'keyTimes', 'limitingConeAngle',
  'markerHeight', 'markerUnits', 'markerWidth', 'maskContentUnits', 'maskUnits', 'numOctaves',
  'pathLength', 'patternContentUnits', 'patternTransform', 'patternUnits', 'pointsAtX', 'pointsAtY',
  'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio', 'primitiveUnits', 'refX', 'refY', 'repeatCount',
  'repeatDur', 'requiredExtensions', 'requiredFeatures', 'specularConstant', 'specularExponent',
  'spreadMethod', 'startOffset', 'stdDeviation', 'surfaceScale', 'systemLanguage', 'tableValues',
  'targetX', 'targetY', 'textLength', 'viewBox', 'viewTarget', 'zoomAndPan'
];

describe('Attribute mapping tables', function () {
  describe('lowerCaseAttributes', function () {
    lowerCaseAttributes.forEach(function (name) {
      it('Should lowercase ' + name + ' on elements', function () {
        expect(transform('<div ' + name + '="v" />')).to.equal(elementProps(1, 'div', name.toLowerCase()));
      });

      it('Should keep ' + name + ' on components', function () {
        expect(transform('<Foo ' + name + '="v" />')).to.equal(componentProps(name));
      });
    });
  });

  describe('attrsSVG', function () {
    Object.keys(svgAttributes).forEach(function (name) {
      it('Should map ' + name + ' to ' + svgAttributes[name] + ' on elements', function () {
        expect(transform('<rect ' + name + '="v" />')).to.equal(elementProps(32, 'rect', svgAttributes[name]));
      });

      it('Should keep ' + name + ' on components', function () {
        expect(transform('<Foo ' + name + '="v" />')).to.equal(componentProps(name));
      });
    });
  });

  describe('attributeTransforms', function () {
    Object.keys(attributeTransforms).forEach(function (name) {
      it('Should map ' + name + ' to ' + attributeTransforms[name] + ' on elements', function () {
        expect(transform('<div ' + name + '="v" />')).to.equal(elementProps(1, 'div', attributeTransforms[name]));
      });

      it('Should keep ' + name + ' on components', function () {
        expect(transform('<Foo ' + name + '="v" />')).to.equal(componentProps(name));
      });
    });
  });

  describe('case-sensitive SVG attributes', function () {
    svgCamelCaseAttributes.forEach(function (name) {
      it('Should keep ' + name + ' in camelCase', function () {
        expect(transform('<rect ' + name + '="v" />')).to.equal(elementProps(32, 'rect', name));
      });
    });
  });
});
