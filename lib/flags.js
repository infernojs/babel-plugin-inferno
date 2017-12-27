'use strict';

module.exports.VNodeFlags = {
    HtmlElement:1,
    ComponentUnknown:2,
    ComponentClass:4,
    ComponentFunction:8,
    Text:16,
    SvgElement:32,
    MediaElement:64,
    InputElement:128,
    TextareaElement:256,
    SelectElement:512,
    Void:1024,
    Portal:2048,
    ReCreate:4096,
    Ignore:8192,
    FormElement:896,
    Element:993,
    Component:14,
    VNodeShape:2045,
};

module.exports.ChildFlags = {
    HasInvalidChildren: 1,
    HasVNodeChildren: 2,
    HasNonKeyedChildren: 4,
    HasKeyedChildren: 8,
    MultipleChildren: 12,
};
