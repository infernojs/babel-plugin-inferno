'use strict';

var isComponent = require('./helpers/is-component');
var isNullOrUndefined = require('./helpers/is-null-or-undefined');
var VNodeFlags = require('inferno-vnode-flags');

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
		.filter(function(line) {
			return line.length > 0;
		})
		.join('');

	if (str.length > 0) {
		return str;
	}
	return '';
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

function addCreateVNodeImportStatement(t, toInsert, opts) {
	var node = toInsert.node;
	var index = toInsert.index;

	if (opts.imports) {
		node.body.splice(index, 0, t.importDeclaration([
			t.ImportSpecifier(t.identifier('createVNode'), t.identifier('createVNode'))
		], t.stringLiteral('inferno')));
	} else {
		node.body.splice(index, 0, t.VariableDeclaration('var', [
			t.VariableDeclarator(
				t.Identifier('createVNode'),
				t.memberExpression(t.identifier('Inferno'), t.identifier('createVNode'))
			)
		]));
	}
}

function getVNodeType(t, type) {
	var astType = type.type;
	var component = false;
	var flags;

	if (astType === 'JSXIdentifier') {
		if (isComponent(type.name)) {
			component = true;
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
			case 'media':
				flags = VNodeFlags.MediaElement;
				break;
			default:
				flags = VNodeFlags.HtmlElement;
			}
		}
	} else if (astType === 'JSXMemberExpression') {
		component = true;
		flags = VNodeFlags.ComponentUnknown;
	}
	return {
		type: type,
		isComponent: component,
		flags: flags
	};
}

function getVNodeChildren(t, astChildren) {
	var children = [];

	for (var i = 0; i < astChildren.length; i++) {
		var child = astChildren[i];
		var vNode = createVNode(t, child);

		if (!isNullOrUndefined(vNode)) {
			children.push(vNode);
		}
	}
	return children.length === 1 ? children[0] : t.arrayExpression(children);
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

function getVNodeProps(t, astProps, isComponent) {
	var props = [];
	var key = null;
	var ref = null;
	var events = null;
	var hasKeyedChildren = false;
	var hasNonKeyedChildren = false;
	var noNormalize = false;

	for (var i = 0; i < astProps.length; i++) {
		var astProp = astProps[i];

		if (astProp.type === 'JSXSpreadAttribute') {
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
			if (propName.substr(0, 11) === 'onComponent' && isComponent) {
				if (!ref) {
					ref = t.ObjectExpression([]);
				}
				ref.properties.push(
					t.ObjectProperty(getName(t, propName), getValue(t, astProp.value))
				);
			} else if (propName.substr(0, 2) === 'on' && !isComponent) {
				if (!events) {
					events = t.ObjectExpression([]);
				}
				events.properties.push(
					t.ObjectProperty(getName(t, propName), getValue(t, astProp.value))
				);
			} else {
				switch (propName) {
				case 'noNormalize':
					noNormalize = true;
					break;
				case 'hasNonKeyedChildren':
					hasNonKeyedChildren = true;
					break;
				case 'hasKeyedChildren':
					hasKeyedChildren = true;
					break;
				case 'ref':
					ref = getValue(t, astProp.value);
					break;
				case 'key':
					key = getValue(t, astProp.value);
					break;
				default:
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
		props: isNullOrUndefined(props) ? t.identifier('null') : props = t.ObjectExpression(
            props.map(function (prop) {
	return !prop.astSpread
                ? t.ObjectProperty(prop.astName, prop.astValue)
                : t.SpreadProperty(prop.astSpread);
})
		),
		key: isNullOrUndefined(key) ? t.identifier('null') : key,
		ref: isNullOrUndefined(ref) ? t.identifier('null') : ref,
		hasKeyedChildren: hasKeyedChildren,
		hasNonKeyedChildren: hasNonKeyedChildren,
		noNormalize: noNormalize,
		events: events
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

function createVNodeArgs(t, flags, type, props, children, key, ref, events, noNormalize) {
	var args = [];
	var nill = t.identifier('null');

	if (noNormalize) {
		args.unshift(t.BooleanLiteral(true));
	}
	if (!isAstNull(ref)) {
		args.unshift(ref);
	} else if (noNormalize) {
		args.unshift(nill);
	}

	if (!isAstNull(key)) {
		args.unshift(key);
	} else if (!isAstNull(ref) || noNormalize) {
		args.unshift(nill);
	}

	if (!isAstNull(events)) {
		args.unshift(events);
	} else if (!isAstNull(ref) || !isAstNull(key) || noNormalize) {
		args.unshift(nill);
	}

	if (!isAstNull(children)) {
		args.unshift(children);
	} else if (!isAstNull(key) || !isAstNull(ref) || !isAstNull(events) || noNormalize) {
		args.unshift(nill);
	}

	if (props.properties && props.properties.length > 0) {
		args.unshift(props);
	} else if (!isAstNull(children) || !isAstNull(key) || !isAstNull(ref) || !isAstNull(events) || noNormalize) {
		args.unshift(nill);
	}

	args.unshift(type);
	args.unshift(t.NumericLiteral(flags));
	return args;
}

function createVNode(t, astNode) {
	var astType = astNode.type;

	switch (astType) {
	case 'JSXElement':
		var openingElement = astNode.openingElement;
		var vType = getVNodeType(t, openingElement.name);
		var vProps = getVNodeProps(t, openingElement.attributes, vType.isComponent);
		var vChildren = getVNodeChildren(t, astNode.children);

		var flags = vType.flags;
		var props = vProps.props;

		if (vProps.hasKeyedChildren) {
			flags = flags | VNodeFlags.HasKeyedChildren;
		}
		if (vProps.hasNonKeyedChildren) {
			flags = flags | VNodeFlags.HasNonKeyedChildren;
		}
		if (vType.isComponent && vChildren) {
			var addChildrenToProps = true;

			if (vChildren.type === 'ArrayExpression' && vChildren.elements.length === 0) {
				addChildrenToProps = false;
			}
			if (addChildrenToProps) {
				if (props.properties) {
					props.properties.push(
							t.ObjectProperty(
								t.identifier('children'),
								vChildren
							)
						);
				} else {
					props = t.ObjectExpression([
						t.ObjectProperty(
								t.identifier('children'),
								vChildren
							)
					]);
				}
			}
			vChildren = t.identifier('null');
		}

		return t.callExpression(
				t.identifier('createVNode'),
				createVNodeArgs(
					t,
					flags,
					vType.type,
					props,
					vChildren,
					vProps.key,
					vProps.ref,
					vProps.events,
					vProps.noNormalize
				)
			);
	case 'JSXText':
		var text = handleWhiteSpace(astNode.value);

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
			// TODO
		break;
	}
}

module.exports = function (options) {
	var t = options.types;

	return {
		visitor: {
			JSXElement: {
				enter: function (path, state) {
					var opts = state.opts;
					var node = createVNode(t, path.node);

					path.replaceWith(node);
					if (!opts.hoistCreateVNode) {
						opts.hoistCreateVNode = true;
						addCreateVNodeImportStatement(t, getHoistedNode(path.node, path.parentPath), opts);
					}
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};
