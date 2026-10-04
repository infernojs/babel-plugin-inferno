var jsx = require('@babel/plugin-syntax-jsx').default;
var t = require('@babel/types');
var flags = require('./flags.js');
var reactAttributeTransforms = require('./attributeTransforms.js');
var lowercaseAttributes = require('./lowerCaseAttributes.js');
var svgAttributes = require('./attrsSVG.js');
var VNodeTypes = require('./vNodeTypes.js');
var VNodeFlags = flags.VNodeFlags;
var ChildFlags = flags.ChildFlags;
var childBits = flags.childBits;

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
// Removed in Inferno 10, using it is an error
var PROP_ReCreate = '$ReCreate';
var PROP_ChildFlag = '$ChildFlag';
var PROP_FLAGS = '$Flags';

// Child flags in the order they take precedence over each other
var CHILD_FLAG_PROPS = [PROP_ChildFlag, PROP_HasKeyedChildren, PROP_HasNonKeyedChildren, PROP_TEXT_CHILDREN, PROP_VNODE_CHILDREN];
var USELESS_FLAGS_LEVELS = ['warn', 'error', 'off'];

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

// The array is created with the first flag, as most elements have none
function addFlagProp(flagProps, astProp) {
  if (flagProps === null) {
    return [astProp];
  }
  flagProps.push(astProp);
  return flagProps;
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
  var propChildren = null;
  var childFlags = null;
  var flagsOverride = null;
  var contentEditable = false;
  // The special flag attributes, for the useless flag checks
  var flagProps = null;
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
          flagProps = addFlagProp(flagProps, astProp);
          childrenKnown = true;
          childFlags = getValue(t, astProp.value);
          break;
        case PROP_VNODE_CHILDREN:
          flagProps = addFlagProp(flagProps, astProp);
          childrenKnown = true;
          break;
        case PROP_FLAGS:
          flagProps = addFlagProp(flagProps, astProp);
          flagsOverride = getValue(t, astProp.value);
          break;
        case PROP_TEXT_CHILDREN:
          flagProps = addFlagProp(flagProps, astProp);
          childrenKnown = true;
          hasTextChildren = true;
          break;
        case PROP_HasNonKeyedChildren:
          flagProps = addFlagProp(flagProps, astProp);
          childrenKnown = true;
          hasNonKeyedChildren = true;
          break;
        case PROP_HasKeyedChildren:
          flagProps = addFlagProp(flagProps, astProp);
          childrenKnown = true;
          hasKeyedChildren = true;
          break;
        case 'ref':
          // A valueless ref would be true, which is neither a callback nor a ref object
          if (!astProp.value) {
            throw fileState.buildCodeFrameError(astProp, 'Please provide an explicit ref value. Using "ref" as a shorthand for "ref={true}" is not allowed.');
          }
          ref = getValue(t, astProp.value);
          break;
        case 'key':
          if (!astProp.value) {
            throw fileState.buildCodeFrameError(astProp, 'Please provide an explicit key value. Using "key" as a shorthand for "key={true}" is not allowed.');
          }
          key = getValue(t, astProp.value);
          break;
        case PROP_ReCreate:
          throw fileState.buildCodeFrameError(astProp, PROP_ReCreate + ' has been removed in Inferno 10. To re-create the element, change its key instead, for example key={version}.');
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
    needsNormalization: needsNormalization,
    contentEditable: contentEditable,
    hasTextChildren: hasTextChildren,
    flagsOverride: flagsOverride,
    flagProps: flagProps
  };
}

// A null value is not passed, like ts-plugin-inferno: <div className={null} /> compiles like <div />
function isAstNull(ast) {
  if (!ast || ast.type === 'NullLiteral') {
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

  // Static children are already in an array; a single dynamic child is passed as written, whatever the child flags
  // say, so that a $ChildFlag declares the shape of the value it is given
  if (hasChildren) {
    args.push(children);
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

/*
 * The flags of newVNode, newComponentVNode and newFragment hold the child bit. A number is folded into one literal,
 * an expression like the value of $Flags gets the bit ORed in.
 */
function packFlags(flags, childBit) {
  if (typeof flags === 'number') {
    return t.numericLiteral(flags | childBit);
  }
  if (flags.type === 'NumericLiteral') {
    return t.numericLiteral(flags.value | childBit);
  }
  return childBit === 0 ? flags : t.binaryExpression('|', flags, t.numericLiteral(childBit));
}

// newVNode(flags, type, className, children, props, key, ref) has no childFlags argument, the flags hold the child bit
function newVNodeArgs(flags, type, className, children, props, key, ref, defineAll) {
  var hasClassName = !isAstNull(className);
  var hasChildren = !isAstNull(children);
  var hasProps = props.properties && props.properties.length > 0;
  var hasKey = !isAstNull(key);
  var hasRef = !isAstNull(ref);
  var args = [flags, type];

  if (hasClassName) {
    args.push(className);
  } else if (defineAll || hasChildren || hasProps || hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasChildren) {
    args.push(children);
  } else if (defineAll || hasProps || hasKey || hasRef) {
    args.push(NULL);
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

// newFragment(flags, children, key), the flags are VNodeFlags.Fragment and the child bit
function newFragmentArgs(children, childFlags, key, defineAll) {
  var hasChildren = !isAstNull(children);
  var hasKey = !isAstNull(key);
  // A fragment without children gets an empty text vNode at runtime, like one that has invalid children
  var args = [t.numericLiteral(VNodeFlags.Fragment | childBits[hasChildren ? childFlags : ChildFlags.HasInvalidChildren])];

  // Static children are already in an array; a single dynamic child is passed as written, whatever the child flags
  // say, so that a $ChildFlag declares the shape of the value it is given
  if (hasChildren) {
    args.push(children);
  } else if (defineAll || hasKey) {
    args.push(NULL);
  }

  if (defineAll || hasKey) {
    args.push(key);
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

// The import is added with the first call, so that children without text do not import newTextVNode
function createTextVNodeCall(text, opts, fileState) {
  fileState.set('newTextVNode', true);

  return withLocation(t.callExpression(
    t.identifier(opts.pragmaTextVNode || 'newTextVNode'),
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

/*
 * Whether the plugin sets the child flags itself because it sees the shape of the children, as it does for static
 * JSX children and for the children props that createVNode compiles without normalization.
 */
function isChildShapeKnown(childrenResults, propChildren, isFragment) {
  if (childrenResults.requiresNormalization) {
    return false;
  }
  var children = childrenResults.children;

  // JSX children replace a children prop
  if (!propChildren || children.type !== 'ArrayExpression' || children.elements.length > 0) {
    return true;
  }
  var value = propChildren.value;

  if (!value || value.type === 'StringLiteral') {
    return true;
  }
  var expression = value.type === 'JSXExpressionContainer' ? value.expression : value;

  if (expression.type === 'NullLiteral') {
    return true;
  }
  // A fragment normalizes a JSX children prop at runtime
  return !isFragment && (expression.type === 'JSXElement' || expression.type === 'JSXFragment');
}

// What a child flag needs, by ChildFlags value
var CHILD_FLAG_NEEDS = {
  1: 'no children',
  2: 'one element or component child',
  4: 'an array of elements or components',
  8: 'an array of elements or components that all have a key',
  16: 'one text child'
};
var CHILD_FLAG_NAMES = {
  0: 'UnknownChildren',
  1: 'HasInvalidChildren',
  2: 'HasVNodeChildren',
  4: 'HasNonKeyedChildren',
  8: 'HasKeyedChildren',
  16: 'HasTextChildren'
};
var CHILD_FLAG_OF_PROP = {};

CHILD_FLAG_OF_PROP[PROP_VNODE_CHILDREN] = ChildFlags.HasVNodeChildren;
CHILD_FLAG_OF_PROP[PROP_TEXT_CHILDREN] = ChildFlags.HasTextChildren;
CHILD_FLAG_OF_PROP[PROP_HasNonKeyedChildren] = ChildFlags.HasNonKeyedChildren;
CHILD_FLAG_OF_PROP[PROP_HasKeyedChildren] = ChildFlags.HasKeyedChildren;

function hasKeyProp(astNode) {
  if (astNode.type !== 'JSXElement') {
    return false;
  }
  var attributes = astNode.openingElement.attributes;

  for (var i = 0; i < attributes.length; i++) {
    if (attributes[i].name && attributes[i].name.name === 'key') {
      return true;
    }
  }
  return false;
}

// Type syntax like `x as T`, `x!` and parentheses do not change the value
function skipTypeSyntax(node) {
  while (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression'
  ) {
    node = node.expression;
  }
  return node;
}

// The kind of a child that an expression gives, as far as the JSX shows it
function expressionChild(expression) {
  expression = skipTypeSyntax(expression);

  switch (expression.type) {
  case 'StringLiteral':
  case 'TemplateLiteral':
  case 'NumericLiteral':
    return {kind: 'text'};
  case 'NullLiteral':
    return {kind: 'empty', code: 'null'};
  case 'BooleanLiteral':
    return {kind: 'empty', code: String(expression.value)};
  case 'ArrayExpression':
    return {kind: 'array', elements: expression.elements};
  case 'JSXElement':
  case 'JSXFragment':
    return {kind: 'vnode', keyed: hasKeyProp(expression)};
  default:
    return {kind: 'dynamic'};
  }
}

// The children the vNode gets, as far as the JSX shows them; JSX children replace a children prop
function childrenShape(astChildren, propChildren) {
  var children = [];

  for (var i = 0; i < astChildren.length; i++) {
    var child = astChildren[i];

    switch (child.type) {
    case 'JSXText':
      if (handleWhiteSpace(child.value) !== '') {
        children.push({kind: 'text'});
      }
      break;
    case 'JSXExpressionContainer':
      if (child.expression.type !== 'JSXEmptyExpression') {
        children.push(expressionChild(child.expression));
      }
      break;
    case 'JSXSpreadChild':
      children.push({kind: 'spread'});
      break;
    default:
      children.push({kind: 'vnode', keyed: hasKeyProp(child)});
    }
  }
  if (children.length === 0 && propChildren) {
    var value = propChildren.value;

    if (!value) {
      children.push({kind: 'empty', code: 'true'});
    } else if (value.type === 'StringLiteral') {
      if (handleWhiteSpace(value.value) !== '') {
        children.push({kind: 'text'});
      }
    } else if (value.type === 'JSXExpressionContainer') {
      if (value.expression.type !== 'JSXEmptyExpression') {
        children.push(expressionChild(value.expression));
      }
    } else {
      children.push({kind: 'vnode', keyed: hasKeyProp(value)});
    }
  }
  return children;
}

function describeSingleChild(child) {
  switch (child.kind) {
  case 'text':
    return 'the child is text';
  case 'empty':
    return 'the child is ' + child.code + ', which renders nothing';
  case 'array':
    return 'the child is an array';
  case 'spread':
    return 'the child is a spread, which makes an array';
  default:
    return 'the child is an element';
  }
}

// Why the children cannot have the shape the child flag declares, or null when they can or the JSX does not show it
function childShapeMismatch(childFlags, children) {
  var count = children.length;
  var child = children[0];
  var i;

  if (childFlags === ChildFlags.HasInvalidChildren) {
    for (i = 0; i < count; i++) {
      if (children[i].kind !== 'empty' && children[i].kind !== 'dynamic') {
        return count === 1 ? describeSingleChild(children[i]) : 'there are ' + count + ' children';
      }
    }
    return null;
  }
  if (count === 0) {
    return 'there are no children';
  }
  if (childFlags === ChildFlags.HasVNodeChildren || childFlags === ChildFlags.HasTextChildren) {
    if (count > 1) {
      return 'there are ' + count + ' children';
    }
    if (child.kind === 'dynamic' || child.kind === (childFlags === ChildFlags.HasVNodeChildren ? 'vnode' : 'text')) {
      return null;
    }
    return describeSingleChild(child);
  }
  // Keyed and non keyed children are an array
  var keyed = childFlags === ChildFlags.HasKeyedChildren;

  if (count === 1) {
    if (child.kind === 'dynamic' || child.kind === 'spread') {
      return null;
    }
    if (child.kind !== 'array') {
      return child.kind === 'vnode' ? 'the only child is an element, not an array' : describeSingleChild(child);
    }
    if (keyed) {
      for (i = 0; i < child.elements.length; i++) {
        var element = child.elements[i] && skipTypeSyntax(child.elements[i]);

        if (element && (element.type === 'JSXElement' || element.type === 'JSXFragment') && !hasKeyProp(element)) {
          return 'the array item at index ' + i + ' has no key';
        }
      }
    }
    return null;
  }
  for (i = 0; i < count; i++) {
    var item = children[i];

    if (item.kind === 'empty') {
      return 'the child at index ' + i + ' is ' + item.code + ', which renders nothing';
    }
    if (item.kind === 'array') {
      return 'the child at index ' + i + ' is an array, which makes a nested array';
    }
    if (keyed && item.kind === 'text') {
      return 'the child at index ' + i + ' is text, which has no key';
    }
    if (keyed && item.kind === 'vnode' && !item.keyed) {
      return 'the child at index ' + i + ' has no key';
    }
  }
  return null;
}

/*
 * Throws for the child flag that the vNode uses when the JSX shows that its children cannot have the declared shape,
 * because Inferno would render them wrong or throw in development.
 */
function checkChildFlagShape(flagProps, astChildren, propChildren, fileState) {
  var winner = null;

  for (var i = 0; i < flagProps.length; i++) {
    var name = flagProps[i].name.name;

    if (CHILD_FLAG_PROPS.indexOf(name) !== -1 && (winner === null || CHILD_FLAG_PROPS.indexOf(name) < CHILD_FLAG_PROPS.indexOf(winner.name.name))) {
      winner = flagProps[i];
    }
  }
  if (winner === null) {
    return;
  }
  var label = winner.name.name;
  var childFlags;

  if (label === PROP_ChildFlag) {
    var value = winner.value && winner.value.type === 'JSXExpressionContainer' ? winner.value.expression : null;

    // An expression is only known at runtime
    if (!value || value.type !== 'NumericLiteral') {
      return;
    }
    childFlags = value.value;
    if (!hasOwn(CHILD_FLAG_NAMES, childFlags)) {
      throw fileState.buildCodeFrameError(winner, PROP_ChildFlag + '={' + childFlags + '} is not a ChildFlags value. Use 0 (UnknownChildren), 1 (HasInvalidChildren), ' +
        '2 (HasVNodeChildren), 4 (HasNonKeyedChildren), 8 (HasKeyedChildren) or 16 (HasTextChildren).');
    }
    if (childFlags === ChildFlags.UnknownChildren) {
      return;
    }
    label = PROP_ChildFlag + '={' + childFlags + '} (' + CHILD_FLAG_NAMES[childFlags] + ')';
  } else {
    childFlags = CHILD_FLAG_OF_PROP[label];
  }
  var mismatch = childShapeMismatch(childFlags, childrenShape(astChildren, propChildren));

  if (mismatch !== null) {
    throw fileState.buildCodeFrameError(winner, label + ' needs ' + CHILD_FLAG_NEEDS[childFlags] + ', but ' + mismatch + '.');
  }
}

// Babel has no API for warnings, so they go to the console with the location and code frame of the flag
function reportUselessFlag(astProp, message, level, fileState) {
  if (level === 'error') {
    throw fileState.buildCodeFrameError(astProp, message);
  }
  var loc = astProp.loc;
  var filename = fileState.opts.filename || 'unknown file';

  // JSX built by other plugins has no location, and no code to show
  if (loc) {
    message = filename + ':' + loc.start.line + ':' + (loc.start.column + 1) + ': ' + fileState.buildCodeFrameError(astProp, message).message;
  } else {
    message = filename + ': ' + message;
  }
  console.warn('babel-plugin-inferno: ' + message);
}

// Reports the flags that cannot change the compiled vNode; each flag is reported once, for its first reason
function checkFlags(flagProps, vNodeType, childrenResults, propChildren, level, fileState) {
  var winner = null;
  var i;

  for (i = 0; i < flagProps.length; i++) {
    var flagName = flagProps[i].name.name;

    // The child flag that the compiled vNode uses when the children are dynamic
    if (flagName !== PROP_FLAGS && (winner === null || CHILD_FLAG_PROPS.indexOf(flagName) < CHILD_FLAG_PROPS.indexOf(winner))) {
      winner = flagName;
    }
  }
  var shapeKnown = winner !== null && vNodeType !== TYPE_COMPONENT && isChildShapeKnown(childrenResults, propChildren, vNodeType === TYPE_FRAGMENT);

  for (i = 0; i < flagProps.length; i++) {
    var astProp = flagProps[i];
    var name = astProp.name.name;
    var message = null;

    if (name === PROP_FLAGS) {
      if (vNodeType === TYPE_FRAGMENT) {
        message = name + ' has no effect on Fragments.';
      }
    } else if (vNodeType === TYPE_COMPONENT) {
      message = name + ' has no effect on components. Their children are passed in props.children.';
    } else if (shapeKnown) {
      message = name + ' is not needed: the children are known at compile time, so the plugin sets their child flags. ' +
        'Child flags only help with dynamic children such as {expression}.';
    } else if (name !== winner) {
      message = name + ' is ignored because ' + winner + ' takes precedence. Remove one of them.';
    }

    if (message !== null) {
      reportUselessFlag(astProp, message, level, fileState);
    }
  }
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

    fileState.set('newFragment', true);

    return withLocation(t.callExpression(
      t.identifier(opts.pragmaFragmentVNode || 'newFragment'),
      newFragmentArgs(
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

    if (vProps.flagProps !== null) {
      // Components get their children in props, so child flags do not apply to them
      if (vNodeType !== TYPE_COMPONENT) {
        checkChildFlagShape(vProps.flagProps, astNode.children, vProps.propChildren, fileState);
      }
      if (opts.uselessFlags !== 'off') {
        checkFlags(vProps.flagProps, vNodeType, childrenResults, vProps.propChildren, opts.uselessFlags || 'warn', fileState);
      }
    }

    var childFlags = ChildFlags.HasInvalidChildren;
    var flags = vType.flags;
    var props = vProps.props;
    var overriddenChildren = [];
    // A single fragment child that $HasTextChildren declares as text, which goes in an array like a static one
    var singleTextChild = false;

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

    // A $ChildFlag expression is only known at runtime, the deprecated createVNode and createFragment convert it
    var runtimeChildFlags = null;

    if (vProps.childFlags) {
      if (vProps.childFlags.type === 'NumericLiteral' && hasOwn(childBits, vProps.childFlags.value)) {
        childFlags = vProps.childFlags.value;
      } else {
        runtimeChildFlags = vProps.childFlags;
      }
    } else {
      childFlags = vNodeType !== TYPE_COMPONENT && childrenResults.requiresNormalization && !vProps.childrenKnown ? ChildFlags.UnknownChildren : childFlags;
    }

    if (overriddenChildren.length > 0) {
      vChildren = withOverridden(overriddenChildren, vChildren);
    }

    var createVNodeCall;

    switch (vNodeType) {
    case TYPE_COMPONENT:
      fileState.set('newComponentVNode', true);
      createVNodeCall = t.callExpression(
        t.identifier(opts.pragmaCreateComponentVNode || 'newComponentVNode'),
        createComponentVNodeArgs(
          // Flags of a known component type include HasInvalidChildren, ComponentUnknown is replaced at runtime
          vProps.flagsOverride ? packFlags(vProps.flagsOverride, VNodeFlags.HasInvalidChildren) : flags,
          vType.type,
          props,
          vProps.key,
          vProps.ref,
          defineAll
        )
      );
      break;
    case TYPE_ELEMENT:
      if (runtimeChildFlags) {
        fileState.set('createVNode', true);
        createVNodeCall = t.callExpression(
          t.identifier('createVNode'),
          createVNodeArgs(
            vProps.flagsOverride || flags,
            vType.type,
            vProps.className,
            vChildren,
            runtimeChildFlags,
            props,
            vProps.key,
            vProps.ref,
            defineAll
          )
        );
      } else {
        fileState.set('newVNode', true);
        createVNodeCall = t.callExpression(
          t.identifier(opts.pragma || 'newVNode'),
          newVNodeArgs(
            packFlags(vProps.flagsOverride || flags, childBits[childFlags]),
            vType.type,
            vProps.className,
            vChildren,
            props,
            vProps.key,
            vProps.ref,
            defineAll
          )
        );
      }
      break;
    case TYPE_FRAGMENT:
      if (singleTextChild || (!childrenResults.requiresNormalization && childrenResults.hasSingleChild)) {
        vChildren = t.arrayExpression([vChildren]);
      }
      if (runtimeChildFlags) {
        fileState.set('createFragment', true);
        return withLocation(t.callExpression(
          t.identifier('createFragment'),
          createFragmentVNodeArgs(
            vChildren,
            runtimeChildFlags,
            vProps.key,
            defineAll
          )
        ), astNode);
      }
      fileState.set('newFragment', true);
      return withLocation(t.callExpression(
        t.identifier(opts.pragmaFragmentVNode || 'newFragment'),
        newFragmentArgs(
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

/*
 * The Inferno functions the compiled code calls, in the order they are imported, with the option that names the local
 * binding. The deprecated createVNode and createFragment are only called for a $ChildFlag that is known at runtime.
 */
var HELPERS = [
  ['newVNode', 'pragma'],
  ['createVNode', null],
  ['newFragment', 'pragmaFragmentVNode'],
  ['createFragment', null],
  ['newComponentVNode', 'pragmaCreateComponentVNode'],
  ['normalizeProps', 'pragmaNormalizeProps'],
  ['newTextVNode', 'pragmaTextVNode']
];

function visitorEnter(path, state) {
  var opts = state.opts;
  var defineAll = opts.defineAllArguments === true || opts.defineAllArguments === 'true';
  var node = createVNode(path.node, opts, state.file, defineAll);

  path.replaceWith(node);
}

module.exports = function (api, options) {
  var uselessFlags = options && options.uselessFlags;

  // Checked here so that a mistyped level fails when Babel loads the config instead of being ignored
  if (uselessFlags !== undefined && USELESS_FLAGS_LEVELS.indexOf(uselessFlags) === -1) {
    throw new Error('babel-plugin-inferno: the uselessFlags option must be "warn", "error" or "off", got ' + JSON.stringify(uselessFlags) + '.');
  }

  return {
    visitor: {
      Program: {
        exit: function (path, state) {
          var fileState = state.file;
          var used = HELPERS.filter(function (helper) {
            return fileState.has(helper[0]);
          });

          if (used.length > 0) {
            var opts = state.opts;
            var optionsImports = opts.imports;
            // A string names the module to import from; "true" and "false" are booleans given as strings
            var importIdentifier = typeof optionsImports === 'string' && optionsImports !== 'false' && optionsImports !== 'true' ? optionsImports : 'inferno';

            if (optionsImports !== false && optionsImports !== 'false') {
              var importArray = [];

              for (var i = 0; i < used.length; i++) {
                var name = used[i][0];

                if (!path.scope.hasBinding(name)) {
                  importArray.push(t.importSpecifier(t.identifier((used[i][1] && opts[used[i][1]]) || name), t.identifier(name)));
                }
              }

              if (importArray.length > 0) {
                path.node.body.unshift(
                  path.node.sourceType === 'script'
                    ? requireDeclaration(path, importArray, importIdentifier)
                    : t.importDeclaration(importArray, t.stringLiteral(importIdentifier))
                );
              }
            } else if (!opts.pragma) {
              var varArray = used.map(function (helper) {
                return t.variableDeclarator(
                  t.identifier(helper[0]),
                  t.memberExpression(t.identifier('Inferno'), t.identifier(helper[0]))
                );
              });

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
