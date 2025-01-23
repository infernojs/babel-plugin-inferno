var jsx = require('@babel/plugin-syntax-jsx').default;
var t = require('@babel/types');
var flags = require('./flags.js');
var reactAttributeTransforms = require('./attributeTransforms.js');
var lowercaseAttributes = require('./lowerCaseAttributes.js');
var svgAttributes = require('./attrsSVG.js');
var VNodeTypes = require('./vNodeTypes.js');
var VNodeFlags = flags.VNodeFlags;
var ChildFlags = flags.ChildFlags;

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

function _stringLiteralTrimmer(lastNonEmptyLine, lineCount, line, i) {
  var isFirstLine = (i === 0);
  var isLastLine = (i === lineCount - 1);
  var isLastNonEmptyLine = (i === lastNonEmptyLine);
  // replace rendered whitespace tabs with spaces
  var trimmedLine = line.replace(/\t/g, ' ');
  // trim leading whitespace
  if (!isFirstLine) {
    trimmedLine = trimmedLine.replace(/^[ ]+/, '');
  }
  // trim trailing whitespace
  if (!isLastLine) {
    trimmedLine = trimmedLine.replace(/[ ]+$/, '');
  }
  if (trimmedLine.length > 0) {
    if (!isLastNonEmptyLine) {
      trimmedLine += ' ';
    }
    return trimmedLine;
  }
  return '';
}

function handleWhiteSpace(value) {
  var lines = value.split(/\r\n|\n|\r/);
  var lastNonEmptyLine = 0;

  for (var i = lines.length - 1; i > 0; i--) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmptyLine = i;
      break;
    }
  }
  var str = lines
    .map(_stringLiteralTrimmer.bind(null, lastNonEmptyLine, lines.length))
    .filter(function (line) {
      return line.length > 0;
    })
    .join('');

  if (str.length > 0) {
    return str;
  }
  return '';
}

function jsxMemberExpressionReference(t, node) {
  if (t.isJSXIdentifier(node)) {
    return t.identifier(node.name);
  }
  if (t.isJSXMemberExpression(node)) {
    return t.memberExpression(
      jsxMemberExpressionReference(t, node.object),
      jsxMemberExpressionReference(t, node.property)
    );
  }
}

function getVNodeType(astNode) {
  var astType = astNode.type;
  var flags;
  var type;
  var vNodeType;

  if (astType === 'JSXIdentifier') {
    var astName = astNode.name;

    if (isFragment(astName)) {
      vNodeType = TYPE_FRAGMENT;
    } else if (isComponent(astName)) {
      vNodeType = TYPE_COMPONENT;
      type = t.identifier(astName);
      flags = VNodeFlags.ComponentUnknown;
    } else {
      vNodeType = TYPE_ELEMENT;
      type = t.StringLiteral(astName);
      flags = VNodeTypes[astName] || VNodeFlags.HtmlElement;
    }
  } else if (astType === 'JSXMemberExpression') {
    if (astNode.property.name === 'Fragment') {
      vNodeType = TYPE_FRAGMENT;
    } else {
      vNodeType = TYPE_COMPONENT;
      type = jsxMemberExpressionReference(t, astNode);
      flags = VNodeFlags.ComponentUnknown;
    }
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

  for (var i = 0; i < astChildren.length; i++) {
    var child = astChildren[i];
    var vNode = createVNode(child, opts, fileState, defineAll);

    if (child.type === 'JSXExpressionContainer') {
      requiresNormalization = true;
    } else if (child.type === 'JSXText' && handleWhiteSpace(child.value) !== '') {
      foundText = true;
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

  var hasSingleChild = children.length === 1;

  children = hasSingleChild ? children[0] : t.arrayExpression(children);

  return {
    parentCanBeKeyed: !hasSingleChild && parentCanBeKeyed,
    children: children,
    foundText: foundText,
    parentCanBeNonKeyed: !hasSingleChild && !parentCanBeKeyed && !requiresNormalization && astChildren.length > 1,
    requiresNormalization: requiresNormalization,
    hasSingleChild: hasSingleChild
  };
}

function getValue(t, value) {
  if (!value) {
    return t.BooleanLiteral(true);
  }

  if (value.type === 'JSXExpressionContainer') {
    return value.expression;
  }

  return value;
}

function getName(t, name) {
  if (name.indexOf('-') !== 0) {
    return t.StringLiteral(name);
  }
  return t.identifier(name);
}

function getVNodeProps(astProps, isComponent) {
  var props = [];
  var key = null;
  var ref = null;
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

  for (var i = 0; i < astProps.length; i++) {
    var astProp = astProps[i];

    if (astProp.type === 'JSXSpreadAttribute') {
      needsNormalization = true;
      props.push({
        astName: null,
        astValue: null,
        astSpread: astProp.argument
      });
    } else {
      var propName = astProp.name;

      if (propName.type === 'JSXIdentifier') {
        propName = propName.name;
      } else if (propName.type === 'JSXNamespacedName') {
        propName = propName.namespace.name + ':' + propName.name.name;
      }

      if (!isComponent && (propName === 'className' || propName === 'class')) {
        className = getValue(t, astProp.value);
      } else if (!isComponent && (reactAttributeTransforms[propName])) {
        props.push({
          astName: getName(t, reactAttributeTransforms[propName]),
          astValue: getValue(t, astProp.value),
          astSpread: null
        });
      } else if (!isComponent && lowercaseAttributes.has(propName)) {
        props.push({
          astName: getName(t, propName.toLowerCase()),
          astValue: getValue(t, astProp.value),
          astSpread: null
        });
      } else if (!isComponent && (propName === 'onDoubleClick')) {
        props.push({
          astName: getName(t, 'onDblClick'),
          astValue: getValue(t, astProp.value),
          astSpread: null
        });
      } else if (propName.substring(0, 11) === 'onComponent' && isComponent) {
        if (!ref) {
          ref = t.ObjectExpression([]);
        }
        ref.properties.push(
          t.ObjectProperty(getName(t, propName), getValue(t, astProp.value))
        );
      } else if (!isComponent && propName in svgAttributes) {
        // React compatibility for SVG Attributes
        props.push({
          astName: getName(t, svgAttributes[propName]),
          astValue: getValue(t, astProp.value),
          astSpread: null
        });
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
          key = getValue(t, astProp.value);
          break;
        case PROP_ReCreate:
          hasReCreateFlag = true;
          break;
        default:
          if (propName === 'children') {
            propChildren = astProp;
          }
          if (propName.toLowerCase() === 'contenteditable') {
            contentEditable = true;
          }
          props.push({
            astName: getName(t, propName),
            astValue: getValue(t, astProp.value),
            astSpread: null
          });
        }
      }
    }
  }
  /* eslint no-return-assign:0 */
  return {
    props: isNullOrUndefined(props) ? NULL : props = t.ObjectExpression(
      props.map(function (prop) {
        if (prop.astSpread) {
          // Babel 6 uses 'SpreadProperty' and Babel 7 uses SpreadElement
          var SpreadOperator = 'SpreadProperty' in t.DEPRECATED_KEYS ? t.SpreadElement : t.SpreadProperty;

          return SpreadOperator(prop.astSpread);
        }

        return t.ObjectProperty(prop.astName, prop.astValue);
      })
    ),
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
    typeof flags === 'number' ? t.NumericLiteral(flags) : flags,
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
    args.push(typeof childFlags === 'number' ? t.NumericLiteral(childFlags) : childFlags);
  } else if (defineAll || hasProps || hasKey || hasRef) {
    args.push(t.NumericLiteral(ChildFlags.HasInvalidChildren));
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
    args.push(typeof childFlags === 'number' ? t.NumericLiteral(childFlags) : childFlags);
  } else if (defineAll || hasKey) {
    args.push(t.NumericLiteral(ChildFlags.HasInvalidChildren));
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
    typeof flags === 'number' ? t.NumericLiteral(flags) : flags,
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

function addCreateTextVNodeCalls(vChildren, opts) {
  // When normalization is not needed we need to manually compile text into vNodes
  for (var j = 0; j < vChildren.elements.length; j++) {
    var aChild = vChildren.elements[j];

    if (aChild.type === 'StringLiteral') {
      vChildren.elements[j] = t.callExpression(
        t.identifier(opts.pragmaTextVNode || 'createTextVNode'),
        [aChild]
      );
    }
  }

  return vChildren;
}

function transformTextNodes(vChildren, childrenResults, opts, fileState) {
  fileState.set('createTextVNode', true);

  if (vChildren.elements) {
    return addCreateTextVNodeCalls(vChildren, opts);
  }
  if (vChildren.type === 'StringLiteral') {
    return t.callExpression(
      t.identifier(opts.pragmaTextVNode || 'createTextVNode'),
      [vChildren]
    );
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

    fileState.set('createFragment', true);

    return t.callExpression(
      t.identifier(opts.pragmaFragmentVNode || 'createFragment'),
      createFragmentVNodeArgs(
        vChildren,
        childFlags,
        defineAll
      )
    );
  case 'JSXElement':
    var openingElement = astNode.openingElement;
    var vType = getVNodeType(openingElement.name);
    var vNodeType = vType.vNodeType;
    var vProps = getVNodeProps(openingElement.attributes, vNodeType === TYPE_COMPONENT);
    childrenResults = getVNodeChildren(astNode.children, opts, fileState, defineAll, vProps.childrenKnown || vNodeType === TYPE_COMPONENT);
    vChildren = childrenResults.children;

    var childFlags = ChildFlags.HasInvalidChildren;
    var flags = vType.flags;
    var props = vProps.props;
    var i = 0;

    if (vProps.hasReCreateFlag) {
      flags = flags | VNodeFlags.ReCreate;
    }
    if (vProps.contentEditable) {
      flags = flags | VNodeFlags.ContentEditable;
    }
    if (vNodeType === TYPE_COMPONENT) {
      if (vChildren) {
        if (!(vChildren.type === 'ArrayExpression' && vChildren.elements.length === 0)) {
          // Remove children from props, if it exists

          for (i = 0; i < props.properties.length; i++) {
            if (props.properties[i].key && props.properties[i].key.value === 'children') {
              props.properties.splice(i, 1); // Remove prop children
              break;
            }
          }

          props.properties.push(
            t.ObjectProperty(
              t.identifier('children'),
              vChildren
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
            if (vNodeType !== TYPE_FRAGMENT) {
              childrenResults.foundText = true;
              childrenResults.hasSingleChild = true;
            }
            vChildren = t.StringLiteral(text);
          } else {
            vChildren = NULL;
            childFlags = ChildFlags.HasInvalidChildren;
          }
        } else if (vProps.propChildren.value.type === 'JSXExpressionContainer') {
          if (vProps.propChildren.value.expression.type === 'JSXEmptyExpression' ||
              vProps.propChildren.value.expression.type === 'NullLiteral') {
            vChildren = NULL;
            childFlags = ChildFlags.HasInvalidChildren;
          } else {
            vChildren = vProps.propChildren.value.expression;
            childFlags = ChildFlags.HasVNodeChildren;
          }
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
        } else if (childrenResults.hasSingleChild) {
          childFlags = vNodeType === TYPE_FRAGMENT ? ChildFlags.HasNonKeyedChildren : ChildFlags.HasVNodeChildren;
        }
      } else {
        if (vProps.hasKeyedChildren) {
          childFlags = ChildFlags.HasKeyedChildren;
        } else if (vProps.hasNonKeyedChildren) {
          childFlags = ChildFlags.HasNonKeyedChildren;
        }
      }

      for (i = 0; i < props.properties.length; i++) {
        if (props.properties[i].key && props.properties[i].key.value === 'children') {
          props.properties.splice(i, 1); // Remove prop children
          break;
        }
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
      if (!childrenResults.requiresNormalization && childrenResults.hasSingleChild) {
        vChildren = t.arrayExpression([vChildren]);
      }
      return t.callExpression(
        t.identifier(opts.pragmaFragmentVNode || 'createFragment'),
        createFragmentVNodeArgs(
          vChildren,
          childFlags,
          vProps.key,
          defineAll
        )
      );
    }

    // NormalizeProps will normalizeChildren too
    if (vProps.needsNormalization) {
      fileState.set('normalizeProps', true);
      createVNodeCall = t.callExpression(
        t.identifier(opts.pragmaNormalizeProps || 'normalizeProps'),
        [createVNodeCall]
      );
    }

    return createVNodeCall;
  case 'JSXText':
    text = handleWhiteSpace(astNode.value);

    if (text !== '') {
      return t.StringLiteral(text);
    }
    break;
  case 'JSXExpressionContainer':
    var expression = astNode.expression;

    if (expression && expression.type !== 'JSXEmptyExpression') {
      return expression;
    }
    break;
  default:
    break;
  }
}

function getHoistedNode(lastNode, path) {
  if (path.parentPath === null) {
    var body = path.node.body;
    var index = body.indexOf(lastNode);
    return {
      node: path.node,
      index: index
    };
  } else {
    return getHoistedNode(path.node, path.parentPath);
  }
}

function visitorEnter(path, state) {
  var opts = state.opts;
  var defineAll = opts.defineAllArguments === true || opts.defineAllArguments === 'true';
  var node = createVNode(path.node, opts, state.file, defineAll);

  path.replaceWith(node);

  if (opts.imports === false || opts.imports === 'false') {
    if (!opts.hoistCreateVNode) {
      opts.hoistCreateVNode = true;
      opts.varNode = getHoistedNode(path.node, path.parentPath);
    }
  }
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
            var importIdentifier = typeof optionsImports === 'string' && optionsImports !== 'false' ? optionsImports : 'inferno';

            if (optionsImports !== false && optionsImports !== 'false') {
              var importArray = [];

              if (fileState.has('createVNode') && !path.scope.hasBinding('createVNode')) {
                importArray.push(t.ImportSpecifier(t.identifier(opts.pragma || 'createVNode'), t.identifier('createVNode')));
              }
              if (fileState.has('createFragment') && !path.scope.hasBinding('createFragment')) {
                importArray.push(t.ImportSpecifier(t.identifier(opts.pragmaFragmentVNode || 'createFragment'), t.identifier('createFragment')));
              }
              if (fileState.has('createComponentVNode') && !path.scope.hasBinding('createComponentVNode')) {
                importArray.push(t.ImportSpecifier(t.identifier(opts.pragmaCreateComponentVNode || 'createComponentVNode'), t.identifier('createComponentVNode')));
              }
              if (fileState.has('normalizeProps') && !path.scope.hasBinding('normalizeProps')) {
                importArray.push(t.ImportSpecifier(t.identifier(opts.pragmaNormalizeProps || 'normalizeProps'), t.identifier('normalizeProps')));
              }
              if (fileState.has('createTextVNode') && !path.scope.hasBinding('createTextVNode')) {
                importArray.push(t.ImportSpecifier(t.identifier(opts.pragmaTextVNode || 'createTextVNode'), t.identifier('createTextVNode')));
              }

              if (importArray.length > 0) {
                path.node.body.unshift(t.importDeclaration(importArray, t.stringLiteral(importIdentifier)));
              }
            } else if (!opts.pragma) {
              var varArray = [];

              if (fileState.has('createVNode')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('createVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createVNode'))
                  )
                );
              }
              if (fileState.has('createFragment')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('createFragment'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createFragment'))
                  )
                );
              }
              if (fileState.has('createComponentVNode')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('createComponentVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createComponentVNode'))
                  )
                );
              }
              if (fileState.has('normalizeProps')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('normalizeProps'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('normalizeProps'))
                  )
                );
              }
              if (fileState.has('createTextVNode')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('createTextVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createTextVNode'))
                  )
                );
              }

              var toInsert = opts.varNode;
              var node = toInsert.node;
              var index = toInsert.index;

              node.body.splice(index, 0, t.VariableDeclaration('var', varArray));
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
