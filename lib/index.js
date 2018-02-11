'use strict';

var flags = require('./flags');
var svgAttributes = require('./attrsSVG');
var VNodeFlags = flags.VNodeFlags;
var ChildFlags = flags.ChildFlags;
var isComponent = function isComponent(name) {
  return name.charAt(0).toUpperCase() === name.charAt(0);
};

var isNullOrUndefined = function isNullOrUndefined(obj) {
  return obj === undefined || obj === null;
};
var NULL;

// All special attributes
var PROP_HasKeyedChildren = '$HasKeyedChildren';
var PROP_HasNonKeyedChildren = '$HasNonKeyedChildren';
var PROP_VNODE_CHILDREN = '$HasVNodeChildren';
var PROP_ReCreate = '$ReCreate';
var PROP_ChildFlag = '$ChildFlag';

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

function getVNodeType(t, type) {
  var astType = type.type;
  var component = false;
  var flags;

  if (astType === 'JSXIdentifier') {
    if (isComponent(type.name)) {
      component = true;
      type = t.identifier(type.name);
      flags = VNodeFlags.ComponentUnknown;
    } else {
      var tag = type.name;

      type = t.StringLiteral(tag);
      switch (tag) {
      case 'svg':
        flags = VNodeFlags.SvgElement;
        break;
      case 'input':
        flags = VNodeFlags.InputElement;
        break;
      case 'textarea':
        flags = VNodeFlags.TextareaElement;
        break;
      case 'select':
        flags = VNodeFlags.SelectElement;
        break;
      default:
        flags = VNodeFlags.HtmlElement;
      }
    }
  } else if (astType === 'JSXMemberExpression') {
    component = true;
    type = jsxMemberExpressionReference(t, type);
    flags = VNodeFlags.ComponentUnknown;
  }
  return {
    type: type,
    isComponent: component,
    flags: flags
  };
}

function getVNodeChildren(t, astChildren, opts, fileState, path) {
  var children = [];
  var parentCanBeKeyed = false;
  var requiresNormalization = false;
  var foundText = false;

  for (var i = 0; i < astChildren.length; i++) {
    var child = astChildren[i];
    var vNode = createVNode(t, child, opts, fileState, path);

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
      if (parentCanBeKeyed === false && child.openingElement) {
        var astProps = child.openingElement.attributes;
        var len = astProps.length;

        while (parentCanBeKeyed === false && len-- > 0) {
          var prop = astProps[len];

          if (prop.name && prop.name.name === 'key') {
            parentCanBeKeyed = true;
          }
        }
      }
    }
  }

  // Fix: When there is single child parent cant be keyed either, its faster to use patch than patchKeyed routine in that case
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

function getVNodeProps(t, astProps, isComponent, path) {
  var props = [];
  var key = null;
  var ref = null;
  var className = null;
  var hasKeyedChildren = false;
  var hasNonKeyedChildren = false;
  var childrenKnown = false;
  var needsNormalization = false;
  var hasReCreateFlag = false;
  var propChildren = null;
  var childFlags = null;

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
      } else if (!isComponent && (propName === 'htmlFor')) {
        props.push({
          astName: getName(t, 'for'),
          astValue: getValue(t, astProp.value),
          astSpread: null
        });
      } else if (!isComponent && (propName === 'onDoubleClick')) {
        props.push({
          astName: getName(t, 'onDblClick'),
          astValue: getValue(t, astProp.value),
          astSpread: null
        });
      } else if (propName.substr(0, 11) === 'onComponent' && isComponent) {
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
        case 'noNormalize':
        case '$NoNormalize':
          throw path.buildCodeFrameError('Inferno JSX plugin:\n' + propName + ' is deprecated use: $HasVNodeChildren, or if children shape is dynamic you can use: $ChildFlag={expression} see inferno package:inferno-vnode-flags (ChildFlags) for possible values');
        case 'hasKeyedChildren':
        case 'hasNonKeyedChildren':
          throw path.buildCodeFrameError('Inferno JSX plugin:\n' + propName + ' is deprecated use: ' + '$' + propName.charAt(0).toUpperCase() + propName.slice(1));
        case PROP_ChildFlag:
          childrenKnown = true;
          childFlags = getValue(t, astProp.value);
          break;
        case PROP_VNODE_CHILDREN:
          childrenKnown = true;
          break;
        case PROP_HasNonKeyedChildren:
          hasNonKeyedChildren = true;
          childrenKnown = true;
          break;
        case PROP_HasKeyedChildren:
          hasKeyedChildren = true;
          childrenKnown = true;
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

function createVNodeArgs(t, flags, type, className, children, childFlags, props, key, ref) {
  var args = [];
  var hasClassName = !isAstNull(className);
  var hasChildren = !isAstNull(children);
  var hasChildFlags = childFlags !== ChildFlags.HasInvalidChildren;
  var hasProps = props.properties && props.properties.length > 0;
  var hasKey = !isAstNull(key);
  var hasRef = !isAstNull(ref);
  args.push(t.NumericLiteral(flags));
  args.push(type);

  if (hasClassName) {
    args.push(className);
  } else if (hasChildren || hasChildFlags || hasProps || hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasChildren) {
    args.push(children);
  } else if (hasChildFlags || hasProps || hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasChildFlags) {
    args.push(typeof childFlags === 'number' ? t.NumericLiteral(childFlags) : childFlags);
  } else if (hasProps || hasKey || hasRef) {
    args.push(t.NumericLiteral(ChildFlags.HasInvalidChildren));
  }

  if (hasProps) {
    args.push(props);
  } else if (hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasKey) {
    args.push(key);
  } else if (hasRef) {
    args.push(NULL);
  }

  if (hasRef) {
    args.push(ref);
  }

  return args;
}

function createComponentVNodeArgs(t, flags, type, props, key, ref) {
  var args = [];
  var hasProps = props.properties && props.properties.length > 0;
  var hasKey = !isAstNull(key);
  var hasRef = !isAstNull(ref);
  args.push(t.NumericLiteral(flags));
  args.push(type);

  if (hasProps) {
    args.push(props);
  } else if (hasKey || hasRef) {
    args.push(NULL);
  }

  if (hasKey) {
    args.push(key);
  } else if (hasRef) {
    args.push(NULL);
  }

  if (hasRef) {
    args.push(ref);
  }

  return args;
}

function addCreateTextVNodeCalls(vChildren, t, opts, fileState) {
  // When normalization is not needed we need to manually compile text into vNodes
  for (var j = 0; j < vChildren.elements.length; j++) {
    var aChild = vChildren.elements[j];

    if (aChild.type === 'StringLiteral') {
      fileState.set('createTextVNode', true);
      vChildren.elements[j] = t.callExpression(
        t.identifier(opts.pragmaTextVNode || 'createTextVNode'),
        [aChild]
      );
    }
  }
}

function createVNode(t, astNode, opts, fileState, path) {
  var astType = astNode.type;
  var text;

  switch (astType) {
  case 'JSXElement':
    var openingElement = astNode.openingElement;
    var vType = getVNodeType(t, openingElement.name);
    var vProps = getVNodeProps(t, openingElement.attributes, vType.isComponent, path);
    var childrenResults = getVNodeChildren(t, astNode.children, opts, fileState, path);
    var vChildren = childrenResults.children;
    var childFlags = ChildFlags.HasInvalidChildren;
    var flags = vType.flags;
    var props = vProps.props;
    var childIndex = -1;
    var i = 0;

    if (vProps.hasReCreateFlag) {
      flags = flags | VNodeFlags.ReCreate;
    }
    if (vType.isComponent) {
      if (vChildren) {
        if (!(vChildren.type === 'ArrayExpression' && vChildren.elements.length === 0)) {
          // Remove children from props, if it exists

          for (i = 0; i < props.properties.length; i++) {
            if (props.properties[i].key && props.properties[i].key.value === 'children') {
              childIndex = i;
              break;
            }
          }
          if (childIndex !== -1) {
            props.properties.splice(childIndex, 1); // Remove prop children
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
            childrenResults.foundText = true;
            childrenResults.hasSingleChild = true;
            vChildren = t.StringLiteral(text);
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
        } else if (childrenResults.hasSingleChild) {
          childFlags = ChildFlags.HasVNodeChildren;
        }
      } else {
        if (vProps.hasKeyedChildren) {
          childFlags = ChildFlags.HasKeyedChildren;
        } else if (vProps.hasNonKeyedChildren) {
          childFlags = ChildFlags.HasNonKeyedChildren;
        }
      }

      // Remove children from props, if it exists
      childIndex = -1;

      for (i = 0; i < props.properties.length; i++) {
        if (props.properties[i].key && props.properties[i].key.value === 'children') {
          childIndex = i;
          break;
        }
      }
      if (childIndex !== -1) {
        props.properties.splice(childIndex, 1); // Remove prop children
      }
    }

    if (vChildren && vChildren !== NULL) {
      if (childrenResults.foundText) {
        if (childrenResults.hasSingleChild) {
          fileState.set('createTextVNode', true);
          vChildren = t.callExpression(
            t.identifier(opts.pragmaTextVNode || 'createTextVNode'),
            [vChildren]
          );
        } else if (vChildren.elements) {
          addCreateTextVNodeCalls(vChildren, t, opts, fileState);
        }
      }
    }

    var willNormalizeChildren = !vType.isComponent && childrenResults.requiresNormalization && !vProps.childrenKnown;

    if (vProps.childFlags) {
      // If $ChildFlag is provided it is runtime dependant
      childFlags = vProps.childFlags;
    } else {
      childFlags = willNormalizeChildren ? ChildFlags.UnknownChildren : childFlags;
    }

    var createVNodeCall = t.callExpression(
      vType.isComponent ? t.identifier(opts.pragmaCreateComponentVNode || 'createComponentVNode') : t.identifier(opts.pragma || 'createVNode'),
      vType.isComponent ?
        createComponentVNodeArgs(
          t,
          flags,
          vType.type,
          props,
          vProps.key,
          vProps.ref
        ) : createVNodeArgs(
          t,
          flags,
          vType.type,
          vProps.className,
          vChildren,
          childFlags,
          props,
          vProps.key,
          vProps.ref
        )
    );
    if (vType.isComponent) {
      fileState.set('createComponentVNode', true);
    } else {
      fileState.set('createVNode', true);
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

module.exports = function (options) {
  var t = options.types;
  NULL = t.identifier('null');

  return {
    visitor: {
      Program: {
        enter: function (path, state) {
          // Keep status in state which imports are needed by the file
          var fileState = state.file;

          fileState.set('normalizeProps', false);
          fileState.set('createTextVNode', false);
          fileState.set('createComponentVNode', false);
          fileState.set('createVNode', false);
        },
        exit: function (path, state) {
          var fileState = state.file;

          var needsAnyImports = (
            fileState.get('createVNode') ||
                        fileState.get('createComponentVNode') ||
                        fileState.get('normalizeProps') ||
                        fileState.get('createTextVNode')
          );

          if (needsAnyImports) {
            var opts = state.opts;
            var optionsImports = opts.imports;
            var importIdentifier = typeof optionsImports === 'string' && optionsImports !== 'false' ? optionsImports : 'inferno';

            if (optionsImports !== false && optionsImports !== 'false') {
              var importArray = [];

              if (fileState.get('createVNode') && !path.scope.hasBinding('createVNode')) {
                importArray.push(t.ImportSpecifier(t.identifier('createVNode'), t.identifier(opts.pragma || 'createVNode')));
              }
              if (fileState.get('createComponentVNode') && !path.scope.hasBinding('createComponentVNode')) {
                importArray.push(t.ImportSpecifier(t.identifier('createComponentVNode'), t.identifier(opts.pragmaCreateComponentVNode || 'createComponentVNode')));
              }
              if (fileState.get('normalizeProps') && !path.scope.hasBinding('normalizeProps')) {
                importArray.push(t.ImportSpecifier(t.identifier('normalizeProps'), t.identifier(opts.pragmaNormalizeProps || 'normalizeProps')));
              }
              if (fileState.get('createTextVNode') && !path.scope.hasBinding('createTextVNode')) {
                importArray.push(t.ImportSpecifier(t.identifier('createTextVNode'), t.identifier(opts.pragmaTextVNode || 'createTextVNode')));
              }

              if (importArray.length > 0) {
                path.node.body.unshift(t.importDeclaration(importArray, t.stringLiteral(importIdentifier)));
              }
            } else if (!opts.pragma) {
              var varArray = [];

              if (fileState.get('createVNode')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('createVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createVNode'))
                  )
                );
              }
              if (fileState.get('createComponentVNode')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('createComponentVNode'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('createComponentVNode'))
                  )
                );
              }
              if (fileState.get('normalizeProps')) {
                varArray.push(
                  t.VariableDeclarator(
                    t.Identifier('normalizeProps'),
                    t.memberExpression(t.identifier('Inferno'), t.identifier('normalizeProps'))
                  )
                );
              }
              if (fileState.get('createTextVNode')) {
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
        enter: function (path, state) {
          var opts = state.opts;
          var node = createVNode(t, path.node, opts, state.file, path);

          path.replaceWith(node);

          if (opts.imports === false || opts.imports === 'false') {
            if (!opts.hoistCreateVNode) {
              opts.hoistCreateVNode = true;
              opts.varNode = getHoistedNode(path.node, path.parentPath);
            }
          }
        }
      }
    },
    inherits: require('babel-plugin-syntax-jsx')
  };
};
