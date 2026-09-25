// Every attribute in MDN's SVG attribute reference, checked against the plugin.
// Data retrieved on 2026-09-25 from:
// - MDN: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute (the A to Z and category lists)
// - HTML spec: https://html.spec.whatwg.org/multipage/parsing.html#adjust-svg-attributes
//   This table holds every mixed-case SVG attribute name; all other SVG attributes are lowercase, hyphenated or
//   namespaced. React-style camelCase names of hyphenated and namespaced attributes are mapped by lib/attrsSVG.js
//   and lib/attributeTransforms.js, and camelCase names of lowercase attributes by lib/lowerCaseAttributes.js.
var mocha = require('mocha');
var describe = mocha.describe;
var it = mocha.it;
var expect = require('chai').expect;
var helpers = require('./helpers');
var transform = helpers.transform;

// Attribute names as they appear in the DOM. `class` and `data-*` are tested separately.
// MDN spells the DOM property referrerPolicy; the attribute is lowercase because it is not in the HTML spec table.
var mdnAttributes = [
  'accumulate', 'additive', 'alignment-baseline', 'amplitude', 'attributeName', 'attributeType', 'autofocus',
  'azimuth', 'baseFrequency', 'baseline-shift', 'baseProfile', 'begin', 'bias', 'by', 'calcMode', 'clip',
  'clip-path', 'clip-rule', 'clipPathUnits', 'color', 'color-interpolation', 'color-interpolation-filters',
  'crossorigin', 'cursor', 'cx', 'cy', 'd', 'decoding', 'diffuseConstant', 'direction', 'display', 'divisor',
  'dominant-baseline', 'download', 'dur', 'dx', 'dy', 'edgeMode', 'elevation', 'end', 'exponent',
  'fetchpriority', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'filterUnits', 'flood-color', 'flood-opacity',
  'font-family', 'font-size', 'font-size-adjust', 'font-stretch', 'font-style', 'font-variant', 'font-weight',
  'font-width', 'fr', 'from', 'fx', 'fy', 'glyph-orientation-horizontal', 'glyph-orientation-vertical',
  'gradientTransform', 'gradientUnits', 'height', 'href', 'hreflang', 'id', 'image-rendering', 'in', 'in2',
  'intercept', 'k1', 'k2', 'k3', 'k4', 'kernelMatrix', 'kernelUnitLength', 'keyPoints', 'keySplines', 'keyTimes',
  'lang', 'lengthAdjust', 'letter-spacing', 'lighting-color', 'limitingConeAngle', 'marker-end', 'marker-mid',
  'marker-start', 'markerHeight', 'markerUnits', 'markerWidth', 'mask', 'mask-type', 'maskContentUnits',
  'maskUnits', 'max', 'media', 'method', 'min', 'mode', 'numOctaves', 'offset', 'onauxclick', 'onblur',
  'oncuechange', 'opacity', 'operator', 'order', 'orient', 'origin', 'overflow', 'paint-order', 'path',
  'pathLength', 'patternContentUnits', 'patternTransform', 'patternUnits', 'ping', 'pointer-events', 'points',
  'pointsAtX', 'pointsAtY', 'pointsAtZ', 'preserveAlpha', 'preserveAspectRatio', 'primitiveUnits', 'r', 'radius',
  'referrerpolicy', 'refX', 'refY', 'rel', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures',
  'restart', 'result', 'rotate', 'rx', 'ry', 'scale', 'seed', 'shape-rendering', 'side', 'slope', 'spacing',
  'specularConstant', 'specularExponent', 'spreadMethod', 'startOffset', 'stdDeviation', 'stitchTiles',
  'stop-color', 'stop-opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'style', 'surfaceScale',
  'systemLanguage', 'tabindex', 'tableValues', 'target', 'targetX', 'targetY', 'text-anchor', 'text-decoration',
  'text-overflow', 'text-rendering', 'textLength', 'to', 'transform', 'transform-origin', 'type', 'unicode-bidi',
  'values', 'vector-effect', 'version', 'viewBox', 'visibility', 'white-space', 'width', 'word-spacing',
  'writing-mode', 'x', 'x1', 'x2', 'xChannelSelector', 'xlink:actuate', 'xlink:arcrole', 'xlink:href',
  'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:lang', 'xml:space', 'y', 'y1', 'y2',
  'yChannelSelector', 'z', 'zoomAndPan'
];

// Mixed-case names from the HTML spec table. glyphRef and viewTarget are deprecated and no longer listed on MDN.
var mixedCaseAttributes = [
  'attributeName', 'attributeType', 'baseFrequency', 'baseProfile', 'calcMode', 'clipPathUnits',
  'diffuseConstant', 'edgeMode', 'filterUnits', 'glyphRef', 'gradientTransform', 'gradientUnits', 'kernelMatrix',
  'kernelUnitLength', 'keyPoints', 'keySplines', 'keyTimes', 'lengthAdjust', 'limitingConeAngle', 'markerHeight',
  'markerUnits', 'markerWidth', 'maskContentUnits', 'maskUnits', 'numOctaves', 'pathLength',
  'patternContentUnits', 'patternTransform', 'patternUnits', 'pointsAtX', 'pointsAtY', 'pointsAtZ',
  'preserveAlpha', 'preserveAspectRatio', 'primitiveUnits', 'refX', 'refY', 'repeatCount', 'repeatDur',
  'requiredExtensions', 'requiredFeatures', 'specularConstant', 'specularExponent', 'spreadMethod',
  'startOffset', 'stdDeviation', 'stitchTiles', 'surfaceScale', 'systemLanguage', 'tableValues', 'targetX',
  'targetY', 'textLength', 'viewBox', 'viewTarget', 'xChannelSelector', 'yChannelSelector', 'zoomAndPan'
];

// React-style camelCase names of lowercase attributes
var lowercaseAliases = {
  autoFocus: 'autofocus',
  crossOrigin: 'crossorigin',
  fetchPriority: 'fetchpriority',
  hrefLang: 'hreflang',
  referrerPolicy: 'referrerpolicy',
  tabIndex: 'tabindex'
};

function camelCase(name) {
  return name.replace(/[-:]([a-z])/g, function (match, letter) {
    return letter.toUpperCase();
  });
}

function rectProps(name) {
  return 'createVNode(32, "rect", null, null, 1, {\n  "' + name + '": "v"\n});';
}

describe('SVG attributes (MDN reference)', function () {
  describe('attributes written as in the DOM', function () {
    mdnAttributes.filter(function (name) {
      return mixedCaseAttributes.indexOf(name) === -1;
    }).forEach(function (name) {
      it('Should keep ' + name, function () {
        expect(transform('<rect ' + name + '="v" />')).to.equal(rectProps(name));
      });
    });

    it('Should pass class as the className argument', function () {
      expect(transform('<rect class="v" />')).to.equal('createVNode(32, "rect", "v");');
    });

    it('Should keep data-* attributes', function () {
      expect(transform('<rect data-foo="v" />')).to.equal(rectProps('data-foo'));
    });
  });

  describe('mixed-case attributes from the HTML spec', function () {
    mixedCaseAttributes.forEach(function (name) {
      it('Should keep ' + name + ' in camelCase', function () {
        expect(transform('<rect ' + name + '="v" />')).to.equal(rectProps(name));
      });
    });

    it('Should keep lengthAdjust in camelCase on svg text', function () {
      expect(transform('<svg><text lengthAdjust="spacing" /></svg>')).to.equal('createVNode(32, "svg", null, createVNode(32, "text", null, null, 1, {\n  "lengthAdjust": "spacing"\n}), 2);');
    });

    it('Should keep xChannelSelector and yChannelSelector in camelCase on feDisplacementMap', function () {
      expect(transform('<feDisplacementMap xChannelSelector="R" yChannelSelector="G" />')).to.equal('createVNode(32, "feDisplacementMap", null, null, 1, {\n  "xChannelSelector": "R",\n  "yChannelSelector": "G"\n});');
    });
  });

  describe('camelCase names of hyphenated and namespaced attributes', function () {
    mdnAttributes.filter(function (name) {
      return /[-:]/.test(name);
    }).forEach(function (name) {
      it('Should map ' + camelCase(name) + ' to ' + name, function () {
        expect(transform('<rect ' + camelCase(name) + '="v" />')).to.equal(rectProps(name));
      });
    });
  });

  describe('camelCase names of presentation attributes on their elements', function () {
    it('Should map maskType to mask-type on mask', function () {
      expect(transform('<mask maskType="alpha" />')).to.equal('createVNode(32, "mask", null, null, 1, {\n  "mask-type": "alpha"\n});');
    });

    it('Should map textOverflow to text-overflow on text', function () {
      expect(transform('<text textOverflow="ellipsis" />')).to.equal('createVNode(32, "text", null, null, 1, {\n  "text-overflow": "ellipsis"\n});');
    });

    it('Should map whiteSpace to white-space on text', function () {
      expect(transform('<text whiteSpace="nowrap" />')).to.equal('createVNode(32, "text", null, null, 1, {\n  "white-space": "nowrap"\n});');
    });

    it('Should map fontWidth to font-width on text', function () {
      expect(transform('<text fontWidth="condensed" />')).to.equal('createVNode(32, "text", null, null, 1, {\n  "font-width": "condensed"\n});');
    });
  });

  describe('camelCase names of lowercase attributes', function () {
    Object.keys(lowercaseAliases).forEach(function (name) {
      it('Should map ' + name + ' to ' + lowercaseAliases[name], function () {
        expect(transform('<rect ' + name + '="v" />')).to.equal(rectProps(lowercaseAliases[name]));
      });
    });
  });
});
