var jsx = require('@babel/plugin-syntax-jsx').default;
var t = require('@babel/types');
var flags = require('./flags.js');
var reactAttributeTransforms = require('./attributeTransforms.js');
var lowercaseAttributes = require('./lowerCaseAttributes.js');
var svgAttributes = require('./attrsSVG.js');
var VNodeTypes = require('./vNodeTypes.js');
var VNodeFlags = flags.VNodeFlags;
var ChildFlags = flags.ChildFlags;

// Own properties only, so that names like constructor or __proto__ do not match Object.prototype
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isComponent(name) {
  var firstLetter = name.charAt(0);

  return firstLetter.toUpperCase() === firstLetter;
}

function isNullOrUndefined(obj) {
  return obj === undefined || obj === null;
}

function isFragment(name) {
  return name === 'Fragment' || name === 'Inferno.Fragment' || name === 'React.Fragment';
}

var NULL = t.identifier('null');

// All special attributes
var PROP_HasKeyedChildren = '$HasKeyedChildren';
var PROP_HasNonKeyedChildren = '$HasNonKeyedChildren';
var PROP_VNODE_CHILDREN = '$HasVNodeChildren';
var PROP_TEXT_CHILDREN = '$HasTextChildren';
var PROP_ReCreate = '$ReCreate';
var PROP_ChildFlag = '$ChildFlag';
var PROP_FLAGS = '$Flags';

var TYPE_ELEMENT = 0;
var TYPE_COMPONENT = 1;
var TYPE_FRAGMENT = 2;

var LINE_BREAK = /\r\n|\n|\r/;
var BLANK_LINES = /^[ \t\r\n]*$/;
var NOT_BLANK = /[^ \t]/;
var TABS = /\t/g;

function isBlank(charCode) {
  return charCode === 32 || charCode === 9;
}

/*
 * Collapses the whitespace of JSX text: tabs become spaces, the lines are trimmed of spaces except at the outer ends
 * of the text, lines left empty are dropped and the rest are joined with a space.
 */
function handleWhiteSpace(value) {
  if (value.indexOf('\n') === -1 && value.indexOf('\r') === -1) {
    return value.indexOf('\t') === -1 ? value : value.replace(TABS, ' ');
  }
  // The indentation between elements, the most common text by far
  if (BLANK_LINES.test(value)) {
    return '';
  }
  var lines = value.split(LINE_BREAK);
  var lastLine = lines.length - 1;
  var lastNonEmptyLine = 0;
  var str = '';
  var i;

  for (i = lastLine; i > 0; i--) {
    if (NOT_BLANK.test(lines[i])) {
      lastNonEmptyLine = i;
      break;
    }
  }
  for (i = 0; i <= lastLine; i++) {
    var line = lines[i];
    var start = 0;
    var end = line.length;

    if (i !== 0) {
      while (start < end && isBlank(line.charCodeAt(start))) {
        start++;
      }
    }
    if (i !== lastLine) {
      while (end > start && isBlank(line.charCodeAt(end - 1))) {
        end--;
      }
    }
    if (end > start) {
      var trimmed = line.slice(start, end);

      str += trimmed.indexOf('\t') === -1 ? trimmed : trimmed.replace(TABS, ' ');
      if (i !== lastNonEmptyLine) {
        str += ' ';
      }
    }
  }
  return str;
}

function jsxMemberExpressionReference(t, node, fileState) {
  if (t.isJSXIdentifier(node)) {
    // The object of a member expression tag must be a variable, which a-b in <a-b.c /> cannot be
    if (!t.isValidIdentifier(node.name, false)) {
      throw fileState.buildCodeFrameError(node, node.name + ' is not a valid variable name for a member expression tag.');
    }
    return withLocation(t.identifier(node.name), node);
  }
  if (t.isJSXMemberExpression(node)) {
    var object = jsxMemberExpressionReference(t, node.object, fileState);
    var property = node.property.name;

    // A property that is not an identifier, like bar-baz in <Foo.bar-baz />, needs a computed member access
    if (!t.isValidIdentifier(property, false)) {
      return withLocation(t.memberExpression(object, withLocation(t.stringLiteral(property), node.property), true), node);
    }
    return withLocation(t.memberExpression(object, withLocation(t.identifier(property), node.property)), node);
  }
}

function getVNodeType(astNode, fileState) {
  var astType = astNode.type;
  var flags;
  var type;
  var vNodeType;

  if (astType === 'JSXIdentifier') {
    var astName = astNode.name;

    if (isFragment(astName)) {
      vNodeType = TYPE_FRAGMENT;
    } else if (isComponent(astName) && t.isValidIdentifier(astName, false)) {
      // Names that are not identifiers, like Foo-bar, can only be elements
      vNodeType = TYPE_COMPONENT;
      // Tags keep the location of their name, so source maps point at it like Babel's react-jsx does
      type = withLocation(t.identifier(astName), astNode);
      flags = VNodeFlags.ComponentUnknown;
    } else {
      vNodeType = TYPE_ELEMENT;
      type = withLocation(t.stringLiteral(astName), astNode);
      flags = hasOwn(VNodeTypes, astName) ? VNodeTypes[astName] : VNodeFlags.HtmlElement;
    }
  } else if (astType === 'JSXMemberExpression') {
    if (astNode.property.name === 'Fragment') {
      vNodeType = TYPE_FRAGMENT;
    } else {
      vNodeType = TYPE_COMPONENT;
      type = jsxMemberExpressionReference(t, astNode, fileState);
      flags = VNodeFlags.ComponentUnknown;
    }
  } else if (astType === 'JSXNamespacedName') {
    throw fileState.buildCodeFrameError(astNode, 'Namespace tags like <' + astNode.namespace.name + ':' + astNode.name.name + '> are not supported.');
  }
  return {
    type: type,
    vNodeType: vNodeType,
    flags: flags
  };
}

function getVNodeChildren(astChildren, opts, fileState, defineAll, isChildrenKnown) {
  var children = [];
  var parentCanBeKeyed = false;
  var requiresNormalization = false;
  var foundText = false;
  var foundVNode = false;
  var hasSpreadChild = false;

  for (var i = 0; i < astChildren.length; i++) {
    var child = astChildren[i];
    var vNode = createVNode(child, opts, fileState, defineAll);

    if (child.type === 'JSXExpressionContainer') {
      requiresNormalization = true;
    } else if (child.type === 'JSXSpreadChild') {
      requiresNormalization = true;
      hasSpreadChild = true;
    } else if (child.type === 'JSXText' && vNode) {
      // createVNode drops text that collapses to nothing
      foundText = true;
    } else if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      foundVNode = true;
    }

    if (!isNullOrUndefined(vNode)) {
      children.push(vNode);

      /*
       * Loop direct children to check if they have key property set
       * If they do, flag parent as hasKeyedChildren to increase runtime performance of Inferno
       * When key already found within one of its children, they must all be keyed
       */
      if (!isChildrenKnown && parentCanBeKeyed === false && child.openingElement) {
        var astProps = child.openingElement.attributes;
        var len = astProps.length;

        while (len-- > 0) {
          var prop = astProps[len];

          if (prop.name && prop.name.name === 'key') {
            parentCanBeKeyed = true;
            break;
          }
        }
      }
    }
  }

  // A spread child is only valid inside the children array
  var hasSingleChild = children.length === 1 && !hasSpreadChild;

  children = hasSingleChild ? children[0] : t.arrayExpression(children);

  return {
    parentCanBeKeyed: !hasSingleChild && parentCanBeKeyed,
    children: children,
    foundText: foundText,
    foundVNode: foundVNode,
    parentCanBeNonKeyed: !hasSingleChild && !parentCanBeKeyed && !requiresNormalization && astChildren.length > 1,
    requiresNormalization: requiresNormalization,
    hasSingleChild: hasSingleChild
  };
}

function getValue(t, value) {
  if (!value) {
    return t.booleanLiteral(true);
  }

  if (value.type === 'JSXExpressionContainer') {
    return value.expression;
  }

  if (value.type === 'StringLiteral') {
    // JSX strings have no escape sequences and may span lines, so their source text cannot be printed as is.
    // Build a new literal from the decoded value and collapse line breaks like Babel's react-jsx does.
    var text = value.value.indexOf('\n') === -1 ? value.value : value.value.replace(/\n\s+/g, ' ');
    var literal = withLocation(t.stringLiteral(text), value);

    // Like t.inherits, which would also give every attribute empty comment arrays
    if (value.leadingComments || value.innerComments || value.trailingComments) {
      t.inheritsComments(literal, value);
    }
    return literal;
  }

  return value;
}

function mayHaveSideEffects(node) {
  if (t.isIdentifier(node) || t.isFunction(node)) {
    return false;
  }
  if (t.isTemplateLiteral(node)) {
    return node.expressions.some(mayHaveSideEffects);
  }
  if (t.isLiteral(node)) {
    return false;
  }
  if (t.isArrayExpression(node)) {
    return node.elements.some(function (element) {
      return element !== null && (t.isSpreadElement(element) || mayHaveSideEffects(element));
    });
  }
  if (t.isObjectExpression(node)) {
    return node.properties.some(function (property) {
      return !t.isObjectProperty(property) || property.computed || mayHaveSideEffects(property.value);
    });
  }
  if (t.isUnaryExpression(node) && node.operator !== 'delete') {
    return mayHaveSideEffects(node.argument);
  }
  return true;
}

// A children prop replaced by JSX children is still evaluated before them, like in React's JSX transform
function withOverridden(overridden, value) {
  var expressions = [];

  for (var i = 0; i < overridden.length; i++) {
    var node = overridden[i];

    if (node) {
      var nodes = t.isSequenceExpression(node) ? node.expressions : [node];

      for (var j = 0; j < nodes.length; j++) {
        if (mayHaveSideEffects(nodes[j])) {
          expressions.push(nodes[j]);
        }
      }
    }
  }

  return expressions.length > 0 ? t.sequenceExpression(expressions.concat(value)) : value;
}

// Removes every children prop in place and returns the removed values in source order
function removeChildrenProps(props) {
  var removed = [];

  for (var i = props.properties.length - 1; i >= 0; i--) {
    var prop = props.properties[i];

    if (prop.key && prop.key.value === 'children') {
      removed.unshift(prop.value);
      props.properties.splice(i, 1);
    }
  }

  return removed;
}

function getVNodeProps(astProps, isComponent, fileState) {
  var props = [];
  var key = null;
  var ref = null;
  var hooks = null;
  var className = null;
  var hasTextChildren = false;
  var hasKeyedChildren = false;
  var hasNonKeyedChildren = false;
  var childrenKnown = false;
  var needsNormalization = false;
  var hasReCreateFlag = false;
  var propChildren = null;
  var childFlags = null;
  var flagsOverride = null;
  var contentEditable = false;
  // Duplicates need two attributes, which most elements do not have
  var seenProps = astProps.length > 1 ? Object.create(null) : null;
  var outputProps = seenProps && Object.create(null);

  // Adds a prop and rejects attributes that end up as the same prop, e.g. htmlFor and for
  function addProp(astProp, attributeName, outputName) {
    if (outputProps) {
      if (outputProps[outputName]) {
        throw fileState.buildCodeFrameError(astProp, outputProps[outputName] + ' and ' + attributeName + ' both set the ' + outputName + ' prop. Remove one of them.');
      }
      outputProps[outputName] = attributeName;
    }
    // A non-computed __proto__ key would set the prototype of the props object instead of creating a prop
    props.push(t.objectProperty(t.stringLiteral(outputName), getValue(t, astProp.value), outputName === '__proto__'));
  }

  for (var i = 0; i < astProps.length; i++) {
    var astProp = astProps[i];

    if (astProp.type === 'JSXSpreadAttribute') {
      needsNormalization = true;
      props.push(t.spreadElement(astProp.argument));
    } else {
      var propName = astProp.name;

      if (propName.type === 'JSXIdentifier') {
        propName = propName.name;
      } else if (propName.type === 'JSXNamespacedName') {
        propName = propName.namespace.name + ':' + propName.name.name;
      }

      if (seenProps) {
        if (seenProps[propName]) {
          throw fileState.buildCodeFrameError(astProp, 'Multiple ' + propName + ' props are not supported. Remove the duplicate ' + propName + ' prop.');
        }
        seenProps[propName] = true;
      }

      if (!isComponent && (propName === 'className' || propName === 'class')) {
        if (className !== null) {
          throw fileState.buildCodeFrameError(astProp, 'className and class both set the class name. Remove one of them.');
        }
        className = getValue(t, astProp.value);
      } else if (!isComponent && hasOwn(reactAttributeTransforms, propName)) {
        addProp(astProp, propName, reactAttributeTransforms[propName]);
      } else if (!isComponent && lowercaseAttributes.has(propName)) {
        addProp(astProp, propName, propName.toLowerCase());
      } else if (!isComponent && (propName === 'onDoubleClick')) {
        addProp(astProp, propName, 'onDblClick');
      } else if (isComponent && propName.substring(0, 11) === 'onComponent') {
        if (!hooks) {
          hooks = [];
        }
        hooks.push(
          t.objectProperty(t.stringLiteral(propName), getValue(t, astProp.value))
        );
      } else if (!isComponent && hasOwn(svgAttributes, propName)) {
        // React compatibility for SVG Attributes
        addProp(astProp, propName, svgAttributes[propName]);
      } else {
        switch (propName) {
        case PROP_ChildFlag:
          childrenKnown = true;
          childFlags = getValue(t, astProp.value);
          break;
        case PROP_VNODE_CHILDREN:
          childrenKnown = true;
          break;
        case PROP_FLAGS:
          flagsOverride = getValue(t, astProp.value);
          break;
        case PROP_TEXT_CHILDREN:
          childrenKnown = true;
          hasTextChildren = true;
          break;
        case PROP_HasNonKeyedChildren:
          childrenKnown = true;
          hasNonKeyedChildren = true;
          break;
        case PROP_HasKeyedChildren:
          childrenKnown = true;
          hasKeyedChildren = true;
          break;
        case 'ref':
          ref = getValue(t, astProp.value);
          break;
        case 'key':
          if (!astProp.value) {
            throw fileState.buildCodeFrameError(astProp, 'Please provide an explicit key value. Using "key" as a shorthand for "key={true}" is not allowed.');
          }
          key = getValue(t, astProp.value);
          break;
        case PROP_ReCreate:
          hasReCreateFlag = true;
          break;
        default:
          if (propName === 'children') {
            propChildren = astProp;
          }
          // The length check first avoids a lowercased copy of every other prop name
          if (propName.length === 15 && propName.toLowerCase() === 'contenteditable') {
            contentEditable = true;
          }
          addProp(astProp, propName, propName);
        }
      }
    }
  }
  // Component hooks are passed in the ref argument; a ref attribute is merged in first so that the hook
  // attributes win regardless of their position
  if (hooks) {
    ref = t.objectExpression(ref ? [t.spreadElement(ref)].concat(hooks) : hooks);
  }
  return {
    props: t.objectExpression(props),
    key: isNullOrUndefined(key) ? NULL : key,
    ref: isNullOrUndefined(ref) ? NULL : ref,
    hasKeyedChildren: hasKeyedChildren,
    hasNonKeyedChildren: hasNonKeyedChildren,
    propChildren: propChildren,
    childrenKnown: childrenKnown,
    className: isNullOrUndefined(className) ? NULL : className,
    childFlags: childFlags,
    hasReCreateFlag: hasReCreateFlag,
    needsNormalization: needsNormalization,
    contentEditable: contentEditable,
    hasTextChildren: hasTextChildren,
    flagsOverride: flagsOverride
  };
}

function isAstNull(ast) {
  if (!ast) {
    return true;
  }
  if (ast.type === 'ArrayExpression' && ast.elements.length === 0) {
    return true;
  }
  return ast.name === 'null';
}

function createVNodeArgs(flags, type, className, children, childFlags, props, key, ref, defineAll) {
  var hasClassName = !isAstNull(className);
  var hasChildren = !isAstNull(children);
  var hasChildFlags = childFlags !== ChildFlags.HasInvalidChildren;
  var hasProps = props.properties && props.properties.length > 0;
  var hasKey = !isAstNull(key);
  var hasRef = !isAstNull(ref);
  var args = [
    typeof flags === 'number' ? t.numericLiteral(flags) : flags,
    type
  ];

  if (hasClassName) {
    args.push(className);
  } else if (defineAll || hasChildren || hasChildFlags || hasProps || hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasChildren) {
    args.push(children);
  } else if (defineAll || hasChildFlags || hasProps || hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasChildFlags) {
    args.push(typeof childFlags === 'number' ? t.numericLiteral(childFlags) : childFlags);
  } else if (defineAll || hasProps || hasKey || hasRef) {
    args.push(t.numericLiteral(ChildFlags.HasInvalidChildren));
  }

  if (hasProps) {
    args.push(props);
  } else if (defineAll || hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasKey) {
    args.push(key);
  } else if (defineAll || hasRef) {
    args.push(NULL);
  }

  if (defineAll || hasRef) {
    args.push(ref);
  }

  return args;
}

function createFragmentVNodeArgs(children, childFlags, key, defineAll) {
  var args = [];
  var hasChildren = !isAstNull(children);
  var hasChildFlags = hasChildren && childFlags !== ChildFlags.HasInvalidChildren;
  var hasKey = !isAstNull(key);

  if (hasChildren) {
    if (
      childFlags === ChildFlags.HasVNodeChildren ||
      childFlags === ChildFlags.HasNonKeyedChildren ||
      childFlags === ChildFlags.HasKeyedChildren ||
      childFlags === ChildFlags.UnknownChildren ||
      children.type === 'ArrayExpression') {
      args.push(children);
    } else {
      args.push(t.arrayExpression([children]));
    }
  } else if (defineAll || hasChildFlags || hasKey) {
    args.push(NULL);
  }

  if (hasChildFlags) {
    args.push(typeof childFlags === 'number' ? t.numericLiteral(childFlags) : childFlags);
  } else if (defineAll || hasKey) {
    args.push(t.numericLiteral(ChildFlags.HasInvalidChildren));
  }

  if (defineAll || hasKey) {
    args.push(key);
  }

  return args;
}

function createComponentVNodeArgs(flags, type, props, key, ref, defineAll) {
  var hasProps = props.properties && props.properties.length > 0;
  var hasKey = !isAstNull(key);
  var hasRef = !isAstNull(ref);
  var args = [
    typeof flags === 'number' ? t.numericLiteral(flags) : flags,
    type
  ];

  if (hasProps) {
    args.push(props);
  } else if (defineAll || hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasKey) {
    args.push(key);
  } else if (defineAll || hasRef) {
    args.push(NULL);
  }

  if (defineAll || hasRef) {
    args.push(ref);
  }

  return args;
}

// Gives a generated node the source location of the JSX it replaces, so that source maps point at the JSX
function withLocation(node, astNode) {
  if (astNode.loc) {
    node.loc = astNode.loc;
    node.start = astNode.start;
    node.end = astNode.end;
  }
  return node;
}

// The import is added with the first call, so that children without text do not import createTextVNode
function createTextVNodeCall(text, opts, fileState) {
  fileState.set('createTextVNode', true);

  return withLocation(t.callExpression(
    t.identifier(opts.pragmaTextVNode || 'createTextVNode'),
    [text]
  ), text);
}

function addCreateTextVNodeCalls(vChildren, opts, fileState) {
  // When normalization is not needed we need to manually compile text into vNodes
  for (var j = 0; j < vChildren.elements.length; j++) {
    var aChild = vChildren.elements[j];

    if (aChild.type === 'StringLiteral') {
      vChildren.elements[j] = createTextVNodeCall(aChild, opts, fileState);
    }
  }

  return vChildren;
}

function transformTextNodes(vChildren, childrenResults, opts, fileState) {
  if (vChildren.elements) {
    return addCreateTextVNodeCalls(vChildren, opts, fileState);
  }
  // A single child is a string, or any expression that $HasTextChildren declares as text on a fragment.
  // JSX stays a vNode whatever the flag says.
  if (childrenResults.foundVNode || t.isJSXElement(vChildren) || t.isJSXFragment(vChildren)) {
    return vChildren;
  }
  return createTextVNodeCall(vChildren, opts, fileState);
}

function createVNode(astNode, opts, fileState, defineAll) {
  var astType = astNode.type;
  var text;
  var childrenResults;
  var vChildren;

  switch (astType) {
  case 'JSXFragment':
    childrenResults = getVNodeChildren(astNode.children, opts, fileState, defineAll);
    vChildren = childrenResults.children;
    if (!childrenResults.requiresNormalization) {
      if (childrenResults.parentCanBeKeyed) {
        childFlags = ChildFlags.HasKeyedChildren;
      } else {
        childFlags = ChildFlags.HasNonKeyedChildren;
      }
      if (childrenResults.hasSingleChild) {
        vChildren = t.arrayExpression([vChildren]);
      }
    } else {
      childFlags = ChildFlags.UnknownChildren;
    }

    if (vChildren && vChildren !== NULL && childrenResults.foundText) {
      vChildren = transformTextNodes(vChildren, childrenResults, opts, fileState);
    }

    fileState.set('createFragment', true);

    return withLocation(t.callExpression(
      t.identifier(opts.pragmaFragmentVNode || 'createFragment'),
      createFragmentVNodeArgs(
        vChildren,
        childFlags,
        NULL, // short syntax fragments cannot have a key
        defineAll
      )
    ), astNode);
  case 'JSXElement':
    var openingElement = astNode.openingElement;
    var vType = getVNodeType(openingElement.name, fileState);
    var vNodeType = vType.vNodeType;
    var vProps = getVNodeProps(openingElement.attributes, vNodeType === TYPE_COMPONENT, fileState);
    childrenResults = getVNodeChildren(astNode.children, opts, fileState, defineAll, vProps.childrenKnown || vNodeType === TYPE_COMPONENT);
    vChildren = childrenResults.children;

    var childFlags = ChildFlags.HasInvalidChildren;
    var flags = vType.flags;
    var props = vProps.props;
    var overriddenChildren = [];
    // A single fragment child that $HasTextChildren declares as text, which goes in an array like a static one
    var singleTextChild = false;

    if (vProps.hasReCreateFlag) {
      flags = flags | VNodeFlags.ReCreate;
    }
    if (vProps.contentEditable) {
      flags = flags | VNodeFlags.ContentEditable;
    }
    if (vNodeType === TYPE_COMPONENT) {
      if (vChildren) {
        if (!(vChildren.type === 'ArrayExpression' && vChildren.elements.length === 0)) {
          // JSX children replace children props
          props.properties.push(
            t.objectProperty(
              t.identifier('children'),
              vProps.propChildren ? withOverridden(removeChildrenProps(props), vChildren) : vChildren
            )
          );
        }
        vChildren = NULL;
      }
    } else {
      if (vProps.propChildren && vChildren.type === 'ArrayExpression' && vChildren.elements.length === 0) {
        if (vProps.propChildren.value.type === 'StringLiteral') {
          text = handleWhiteSpace(vProps.propChildren.value.value);

          if (text !== '') {
            childrenResults.foundText = true;
            childrenResults.hasSingleChild = true;
            vChildren = t.stringLiteral(text);
          } else {
            vChildren = NULL;
            childFlags = ChildFlags.HasInvalidChildren;
          }
        } else if (vProps.propChildren.value.type === 'JSXExpressionContainer' &&
            (vProps.propChildren.value.expression.type === 'JSXEmptyExpression' ||
            vProps.propChildren.value.expression.type === 'NullLiteral')) {
          vChildren = NULL;
          childFlags = ChildFlags.HasInvalidChildren;
        } else if (vProps.propChildren.value.type === 'JSXExpressionContainer' ||
            vProps.propChildren.value.type === 'JSXElement' ||
            vProps.propChildren.value.type === 'JSXFragment') {
          // children={expression}, or children=<element /> without braces
          vChildren = vProps.propChildren.value.type === 'JSXExpressionContainer' ? vProps.propChildren.value.expression : vProps.propChildren.value;
          // Only JSX is known to be a single vNode; other values are normalized at runtime like {expression} children
          childFlags = vNodeType !== TYPE_FRAGMENT && (t.isJSXElement(vChildren) || t.isJSXFragment(vChildren) || vProps.childrenKnown) ? ChildFlags.HasVNodeChildren : ChildFlags.UnknownChildren;
        } else {
          vChildren = NULL;
          childFlags = ChildFlags.HasInvalidChildren;
        }
      }
      if (!childrenResults.requiresNormalization || vProps.childrenKnown) {
        if (vProps.hasKeyedChildren || childrenResults.parentCanBeKeyed) {
          childFlags = ChildFlags.HasKeyedChildren;
        } else if (vProps.hasNonKeyedChildren || childrenResults.parentCanBeNonKeyed) {
          childFlags = ChildFlags.HasNonKeyedChildren;
        } else if (vProps.hasTextChildren || (childrenResults.foundText && childrenResults.hasSingleChild)) {
          childrenResults.foundText = vNodeType === TYPE_FRAGMENT;
          childFlags = vNodeType === TYPE_FRAGMENT ? ChildFlags.HasNonKeyedChildren : ChildFlags.HasTextChildren;
          singleTextChild = vNodeType === TYPE_FRAGMENT && vChildren !== NULL && vChildren.type !== 'ArrayExpression';
        } else if (childrenResults.hasSingleChild) {
          // A static fragment child is put in an array below, a dynamic one declared by $HasVNodeChildren is passed as is
          childFlags = vNodeType === TYPE_FRAGMENT && !childrenResults.requiresNormalization ? ChildFlags.HasNonKeyedChildren : ChildFlags.HasVNodeChildren;
        }
      } else {
        if (vProps.hasKeyedChildren) {
          childFlags = ChildFlags.HasKeyedChildren;
        } else if (vProps.hasNonKeyedChildren) {
          childFlags = ChildFlags.HasNonKeyedChildren;
        }
      }

      if (vProps.propChildren) {
        // Children props are passed as the children argument; the one in use is not an overridden value
        overriddenChildren = removeChildrenProps(props).filter(function (value) {
          return value !== vChildren;
        });
      }
    }
    if (vChildren && vChildren !== NULL && childrenResults.foundText) {
      vChildren = transformTextNodes(vChildren, childrenResults, opts, fileState);
    }

    if (vProps.childFlags) {
      // If $ChildFlag is provided it is runtime dependant
      childFlags = vProps.childFlags;
    } else {
      childFlags = vNodeType !== TYPE_COMPONENT && childrenResults.requiresNormalization && !vProps.childrenKnown ? ChildFlags.UnknownChildren : childFlags;
    }

    if (overriddenChildren.length > 0) {
      vChildren = withOverridden(overriddenChildren, vChildren);
    }

    var createVNodeCall;

    switch (vNodeType) {
    case TYPE_COMPONENT:
      fileState.set('createComponentVNode', true);
      createVNodeCall = t.callExpression(
        t.identifier(opts.pragmaCreateComponentVNode || 'createComponentVNode'),
        createComponentVNodeArgs(
          vProps.flagsOverride || flags,
          vType.type,
          props,
          vProps.key,
          vProps.ref,
          defineAll
        )
      );
      break;
    case TYPE_ELEMENT:
      fileState.set('createVNode', true);
      createVNodeCall = t.callExpression(
        t.identifier(opts.pragma || 'createVNode'),
        createVNodeArgs(
          vProps.flagsOverride || flags,
          vType.type,
          vProps.className,
          vChildren,
          childFlags,
          props,
          vProps.key,
          vProps.ref,
          defineAll
        )
      );
      break;
    case TYPE_FRAGMENT:
      fileState.set('createFragment', true);
      if (singleTextChild || (!childrenResults.requiresNormalization && childrenResults.hasSingleChild)) {
        vChildren = t.arrayExpression([vChildren]);
      }
      return withLocation(t.callExpression(
        t.identifier(opts.pragmaFragmentVNode || 'createFragment'),
        createFragmentVNodeArgs(
          vChildren,
          childFlags,
          vProps.key,
          defineAll
        )
      ), astNode);
    }
    withLocation(createVNodeCall, astNode);

    // NormalizeProps will normalizeChildren too
    if (vProps.needsNormalization) {
      fileState.set('normalizeProps', true);
      createVNodeCall = withLocation(t.callExpression(
        t.identifier(opts.pragmaNormalizeProps || 'normalizeProps'),
        [createVNodeCall]
      ), astNode);
    }

    return createVNodeCall;
  case 'JSXText':
    text = handleWhiteSpace(astNode.value);

    if (text !== '') {
      return withLocation(t.stringLiteral(text), astNode);
    }
    break;
  case 'JSXExpressionContainer':
    var expression = astNode.expression;

    if (expression && expression.type !== 'JSXEmptyExpression') {
      return expression;
    }
    break;
  case 'JSXSpreadChild':
    // {...children} spreads an iterable into the children array, like esbuild and TypeScript compile it
    return withLocation(t.spreadElement(astNode.expression), astNode);
  default:
    break;
  }
}

/*
 * Index in the program body for the `var createVNode = Inferno.createVNode` declaration used with imports: false.
 * It goes before any other code so that functions using JSX work wherever they are called from, but after the
 * leading imports and after the file's own declaration of Inferno, e.g. `var Inferno = require('inferno')`.
 */
function getHelpersIndex(programPath) {
  var body = programPath.node.body;
  var index = 0;

  while (index < body.length && t.isImportDeclaration(body[index])) {
    index++;
  }

  var binding = programPath.scope.getOwnBinding('Inferno');

  if (binding) {
    var statement = binding.path.find(function (bindingPath) {
      return bindingPath.parentPath !== null && bindingPath.parentPath.isProgram();
    });

    if (statement) {
      index = Math.max(index, body.indexOf(statement.node) + 1);
    }
  }

  return index;
}

// Scripts cannot contain import declarations, so the helpers are read from a require() call instead
function requireDeclaration(programPath, specifiers, source) {
  var moduleId = programPath.scope.generateUidIdentifier(source);
  var declarators = [
    t.variableDeclarator(moduleId, t.callExpression(t.identifier('require'), [t.stringLiteral(source)]))
  ];

  for (var i = 0; i < specifiers.length; i++) {
    declarators.push(t.variableDeclarator(
      t.identifier(specifiers[i].local.name),
      t.memberExpression(moduleId, t.identifier(specifiers[i].imported.name))
    ));
  }

  return t.variableDeclaration('var', declarators);
}

function visitorEnter(path, state) {
  var opts = state.opts;
  var defineAll = opts.defineAllArguments === true || opts.defineAllArguments === 'true';
  var node = createVNode(path.node, opts, state.file, defineAll);

  path.replaceWith(node);
}

module.exports = function () {
  return {
    visitor: {
      Program: {
        exit: function (path, state) {
          var fileState = state.file;

          var needsAnyImports = Boolean(
            fileState.has('createVNode') ||
            fileState.has('createComponentVNode') ||
            fileState.has('normalizeProps') ||
            fileState.has('createTextVNode') ||
            fileState.has('createFragment')
          );

          if (needsAnyImports) {
            var opts = state.opts;
            var optionsImports = opts.imports;
            // A string names the module to import from; "true" and "false" are booleans given as strings
            var importIdentifier = typeof optionsImports === 'string' && optionsImports !== 'false' && optionsImports !== 'true' ? optionsImports : 'inferno';

            if (optionsImports !== false && optionsImports !== 'false') {
              var importArray = [];

              if (fileState.has('createVNode') && !path.scope.hasBinding('createVNode')) {
                importArray.push(t.importSpecifier(t.identifier(opts.pragma || 'createVNode'), t.identifier('createVNode')));
              }
              if (fileState.has('createFragment') && !path.scope.hasBinding('createFragment')) {
                importArray.push(t.importSpecifier(t.identifier(opts.pragmaFragmentVNode || 'createFragment'), t.identifier('createFragment')));
              }
              if (fileState.has('createComponentVNode') && !path.scope.hasBinding('createComponentVNode')) {
                importArray.push(t.importSpecifier(t.identifier(opts.pragmaCreateComponentVNode || 'createComponentVNode'), t.identifier('createComponentVNode')));
              }
              if (fileState.has('normalizeProps') && !path.scope.hasBinding('normalizeProps')) {
                importArray.push(t.importSpecifier(t.identifier(opts.pragmaNormalizeProps || 'normalizeProps'), t.identifier('normalizeProps')));
              }
              if (fileState.has('createTextVNode') && !path.scope.hasBinding('createTextVNode')) {
                importArray.push(t.importSpecifier(t.identifier(opts.pragmaTextVNode || 'createTextVNode'), t.identifier('createTextVNode')));
              }

              if (importArray.length > 0) {
                path.node.body.unshift(
                  path.node.sourceType === 'script'
                    ? requireDeclaration(path, importArray, importIdentifier)
                    : t.importDeclaration(importArray, t.stringLiteral(importIdentifier))
                );
              }
            } else if (!opts.pragma) {
              var varArray = [];

              if (fileState.has('createVNode')) {
                varArray.push(
                  t.variableDeclarator(
                    t.identifier('createVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createVNode'))
                  )
                );
              }
              if (fileState.has('createFragment')) {
                varArray.push(
                  t.variableDeclarator(
                    t.identifier('createFragment'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createFragment'))
                  )
                );
              }
              if (fileState.has('createComponentVNode')) {
                varArray.push(
                  t.variableDeclarator(
                    t.identifier('createComponentVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createComponentVNode'))
                  )
                );
              }
              if (fileState.has('normalizeProps')) {
                varArray.push(
                  t.variableDeclarator(
                    t.identifier('normalizeProps'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('normalizeProps'))
                  )
                );
              }
              if (fileState.has('createTextVNode')) {
                varArray.push(
                  t.variableDeclarator(
                    t.identifier('createTextVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createTextVNode'))
                  )
                );
              }

              path.node.body.splice(getHelpersIndex(path), 0, t.variableDeclaration('var', varArray));
            }
          }
        }
      },
      JSXElement: {
        enter: visitorEnter
      },
      JSXFragment: {
        enter: visitorEnter
      }
    },
    inherits: jsx
  };
};
