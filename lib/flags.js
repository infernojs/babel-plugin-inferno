'use strict';

// The VNodeFlags of inferno-vnode-flags 10, which the plugin writes into the compiled code
module.exports.VNodeFlags = {
  ComponentUnknown: 0,
  HtmlElement: 1,
  HasTextChildren: 2,
  HasNonKeyedChildren: 4,
  HasVNodeChildren: 8,
  HasInvalidChildren: 16,
  HasKeyedChildren: 32,
  SvgElement: 64,
  ComponentClass: 128,
  Fragment: 256,
  InputElement: 512,
  TextareaElement: 2048,
  SelectElement: 4096,
  ComponentFunction: 8192,
  ContentEditable: 131072,
  FormElement: 6656,
  Element: 6721,
  Component: 8320,
};

// The shape of the children, which the plugin works out and the deprecated createVNode and createFragment take
module.exports.ChildFlags = {
  UnknownChildren: 0,
  HasInvalidChildren: 1,
  HasVNodeChildren: 2,
  HasNonKeyedChildren: 4,
  HasKeyedChildren: 8,
  HasTextChildren: 16,
  MultipleChildren: 12,
};

// The VNodeFlags child bit of each ChildFlags value; unknown children have no bit and are normalized
module.exports.childBits = {
  0: 0,
  1: 16,
  2: 8,
  4: 4,
  8: 32,
  16: 2,
};
