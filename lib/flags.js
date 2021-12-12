'use strict';

module.exports.VNodeFlags = {
  HtmlElement: 1,
  ComponentUnknown: 2,
  ComponentClass: 4,
  ComponentFunction: 8,
  Text: 16,
  SvgElement: 32,
  InputElement: 64,
  TextareaElement: 128,
  SelectElement: 256,
  IsStatic: 512,
  Portal: 1024,
  ReCreate: 2048,
  ContentEditable: 4096,
  Fragment: 8192,
  InUse: 16384,
  ForwardRef: 32768,
  Normalized: 65536,
  ForwardRefComponent: 32776,
  FormElement: 448,
  Element: 481,
  Component: 14,
  DOMRef: 1521,
  InUseOrNormalized: 81920,
  ClearInUse: -16385,
  ComponentKnown: 12
};

module.exports.ChildFlags = {
  UnknownChildren: 0,
  HasInvalidChildren: 1,
  HasVNodeChildren: 2,
  HasNonKeyedChildren: 4,
  HasKeyedChildren: 8,
  HasTextChildren: 16,
  MultipleChildren: 12,
};
