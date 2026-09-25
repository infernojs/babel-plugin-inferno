/*
 * Deterministic synthetic JSX modules for the benchmark. The same seed always gives the same source, so results of
 * different commits are comparable. Bump GENERATOR_VERSION whenever the generated code changes.
 */
var GENERATOR_VERSION = 1;
var SEED = 0x1f2e3d4c;

var TARGETS = {
  'mixed-S': 200,
  'mixed-M': 2000,
  'mixed-L': 20000
};

var WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore ' +
  'et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea ' +
  'commodo consequat').split(' ');
var CONTAINER_TAGS = ['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'ul', 'p', 'span', 'a', 'button', 'label', 'h2', 'h3'];
var COMPONENTS = ['Card', 'Button', 'Panel', 'Avatar', 'Tooltip', 'Layout.Row', 'Layout.Column'];
var CLASS_NAMES = ['row', 'col', 'card', 'card-body', 'btn btn-primary', 'active', 'list-item', 'is-hidden', 'title', 'muted'];

// Small fast seeded PRNG, see https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
function mulberry32(seed) {
  return function () {
    seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);

    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function Generator(seed) {
  this.random = mulberry32(seed);
  this.budget = 0;
  this.ids = 0;
}

Generator.prototype.int = function (min, max) {
  return min + Math.floor(this.random() * (max - min + 1));
};

Generator.prototype.chance = function (p) {
  return this.random() < p;
};

Generator.prototype.pick = function (list) {
  return list[Math.floor(this.random() * list.length)];
};

// Picks a key of weights with a probability proportional to its weight
Generator.prototype.weighted = function (weights) {
  var total = 0;
  var key;

  for (key in weights) {
    total += weights[key];
  }
  var r = this.random() * total;

  for (key in weights) {
    r -= weights[key];
    if (r < 0) {
      return key;
    }
  }
  return key;
};

Generator.prototype.words = function (min, max) {
  var count = this.int(min, max);
  var words = [];

  for (var i = 0; i < count; i++) {
    words.push(this.pick(WORDS));
  }
  return words.join(' ');
};

// Attributes of an HTML element, never the same prop twice because the plugin rejects duplicates
Generator.prototype.htmlAttributes = function (tag) {
  var attributes = [];

  if (this.chance(0.6)) {
    attributes.push('className="' + this.pick(CLASS_NAMES) + '"');
  }
  if (this.chance(0.15)) {
    attributes.push('id="node-' + (this.ids++) + '"');
  }
  if (tag === 'button' || tag === 'a' || this.chance(0.15)) {
    attributes.push('onClick={handlers.click}');
  }
  if (this.chance(0.05)) {
    attributes.push('onDoubleClick={handlers.open}');
  }
  if (tag === 'a') {
    attributes.push('href={"/items/" + props.id}');
  }
  if (tag === 'label') {
    attributes.push('htmlFor="field-' + this.ids + '"');
  }
  if (this.chance(0.1)) {
    attributes.push('tabIndex={0}');
  }
  if (this.chance(0.1)) {
    attributes.push('style={styles.' + this.pick(['box', 'text', 'grid']) + '}');
  }
  if (this.chance(0.1)) {
    attributes.push('data-index={' + this.int(0, 99) + '}');
  }
  if (this.chance(0.08)) {
    attributes.push('aria-label="' + this.words(1, 3) + '"');
  }
  if (this.chance(0.05)) {
    attributes.push('ref={refs.node}');
  }
  if (this.chance(0.02)) {
    attributes.push('contentEditable');
  }
  if (this.chance(0.06)) {
    attributes.push('{...props.rest}');
  }
  return attributes;
};

Generator.prototype.open = function (name, attributes) {
  return '<' + name + (attributes.length > 0 ? ' ' + attributes.join(' ') : '');
};

// Children each on their own line, like hand-formatted code, so the plugin also sees the whitespace text between them
Generator.prototype.withChildren = function (openTag, closeName, children, indent) {
  if (children.length === 0) {
    return openTag + ' />';
  }
  return openTag + '>\n' + children.map(function (child) {
    return indent + '  ' + child;
  }).join('\n') + '\n' + indent + '</' + closeName + '>';
};

Generator.prototype.children = function (depth, indent) {
  var count = depth >= 7 || this.budget <= 0 ? this.int(0, 1) : this.int(1, 4);
  var children = [];

  for (var i = 0; i < count; i++) {
    children.push(this.node(depth + 1, indent + '  '));
  }
  return children;
};

Generator.prototype.node = function (depth, indent) {
  var leafOnly = depth >= 8 || this.budget <= 0;
  var kind = this.weighted(leafOnly ? {
    text: 4,
    expression: 3,
    input: 2
  } : {
    element: 30,
    component: 12,
    svg: 5,
    fragment: 5,
    list: 7,
    conditional: 6,
    text: 14,
    expression: 10,
    input: 8
  });

  switch (kind) {
  case 'element':
    var tag = this.pick(CONTAINER_TAGS);

    this.budget--;
    return this.withChildren(this.open(tag, this.htmlAttributes(tag)), tag, this.children(depth, indent), indent);
  case 'component':
    var name = this.pick(COMPONENTS);
    var props = ['title="' + this.words(1, 3) + '"'];

    this.budget--;
    if (this.chance(0.4)) {
      props.push('item={props.item}');
    }
    if (this.chance(0.2)) {
      props.push('onComponentDidMount={hooks.mount}');
    }
    if (this.chance(0.15)) {
      props.push('{...props.rest}');
    }
    return this.withChildren(this.open(name, props), name, this.chance(0.6) ? this.children(depth, indent) : [], indent);
  case 'svg':
    this.budget -= 3;
    return '<svg viewBox="0 0 24 24" width={24} height={24} fill="none" className="icon">' +
      '<path d="M4 12h16M12 4v16" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />' +
      '<circle cx="12" cy="12" r="3" fillOpacity={0.5} clipPath="url(#clip)" /></svg>';
  case 'fragment':
    this.budget--;
    var fragmentChildren = this.children(depth, indent);

    if (fragmentChildren.length === 0) {
      // <></> has no self-closing form
      fragmentChildren.push(this.words(1, 3));
    }
    return this.withChildren('<', '', fragmentChildren, indent);
  case 'list':
    this.budget--;
    return '{props.items.map(function (item) {\n' +
      indent + '  return <li key={item.id} className="list-item" onClick={handlers.select}>{item.label}</li>;\n' +
      indent + '})}';
  case 'conditional':
    this.budget--;
    return '{state.' + this.pick(['open', 'loading', 'error']) + ' && <span className="badge">' + this.words(1, 2) + '</span>}';
  case 'text':
    // Multi-line text with indentation, which the plugin collapses to single spaces
    return this.words(2, 8) + (this.chance(0.4) ? '\n' + indent + this.words(2, 6) : '');
  case 'expression':
    return this.pick(['{props.value}', '{state.count}', '{props.item.label}', '{format(props.date)}', '{props.children}']);
  default:
    this.budget--;
    return '<input type="text" value={state.value} onInput={handlers.input} maxLength={40} readOnly={props.locked} autoComplete="off" />';
  }
};

Generator.prototype.view = function (index) {
  var tag = this.pick(['div', 'section', 'article']);

  this.budget--;
  return 'export function View' + index + '(props) {\n' +
    '  var state = props.state;\n' +
    '  var handlers = props.handlers;\n' +
    '  return (\n' +
    '    ' + this.withChildren(this.open(tag, this.htmlAttributes(tag)), tag, this.children(0, '    '), '    ') + '\n' +
    '  );\n' +
    '}\n';
};

var HEADER = 'import { Card, Button, Panel, Avatar, Tooltip, Layout } from \'./components\';\n' +
  'import { styles, refs, hooks, format } from \'./shared\';\n\n';

// Random but realistic component trees until about `target` JSX nodes are written
function mixed(target) {
  var generator = new Generator(SEED);
  var views = [];

  while (target > 0) {
    // Each view gets a slice of the budget, so views stay component sized
    generator.budget = Math.min(target, 60);
    var before = generator.budget;

    views.push(generator.view(views.length));
    target -= before - generator.budget;
  }
  return HEADER + views.join('\n');
}

// One list with many keyed children; the key comes first so the plugin's key scan reads all attributes
function wide(count) {
  var items = [];

  for (var i = 0; i < count; i++) {
    items.push('      <li key={' + i + '} className="item" data-index={' + i + '} onClick={handlers.select} tabIndex={-1}>Item ' + i + '</li>');
  }
  return 'export function Wide(props) {\n' +
    '  var handlers = props.handlers;\n' +
    '  return (\n' +
    '    <ul className="list">\n' + items.join('\n') + '\n    </ul>\n' +
    '  );\n' +
    '}\n';
}

// Views with deeply nested elements, `depth` levels each
function deep(views, depth) {
  var tags = ['div', 'section', 'span'];
  var output = [];

  for (var v = 0; v < views; v++) {
    var open = '';
    var close = '';

    for (var d = 0; d < depth; d++) {
      open += '<' + tags[d % 3] + ' className="level-' + d + '">';
      close = '</' + tags[d % 3] + '>' + close;
    }
    output.push('export function Deep' + v + '(props) {\n  return (\n    ' + open + '{props.value}' + close + '\n  );\n}\n');
  }
  return output.join('\n');
}

var GENERATORS = {
  'mixed-S': function () {
    return mixed(TARGETS['mixed-S']);
  },
  'mixed-M': function () {
    return mixed(TARGETS['mixed-M']);
  },
  'mixed-L': function () {
    return mixed(TARGETS['mixed-L']);
  },
  'wide-M': function () {
    return wide(2000);
  },
  'deep-M': function () {
    return deep(10, 200);
  }
};

function generate(name) {
  if (!Object.prototype.hasOwnProperty.call(GENERATORS, name)) {
    throw new Error('Unknown generated case ' + name);
  }
  return GENERATORS[name]();
}

module.exports = {
  GENERATOR_VERSION: GENERATOR_VERSION,
  names: Object.keys(GENERATORS),
  // Cases that take minutes rather than seconds; quick and compare runs skip them unless a filter names them
  large: ['mixed-L'],
  generate: generate
};
