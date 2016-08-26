'use strict';

const createTemplateKey = require('./createTemplateKey');
const addTemplateToModule = require('./addTemplateToModule');
const isComponent = require('./helpers/is-component');

function handleWhiteSpace(str) {
	str = str.replace(/\t/g, '');
	str = str.replace(/(\s*[\r\n]\s*)/g, '');
	return str;
}

function getHoistedNode(lastNode, path) {
	if (path.parentPath === null) {
		const body = path.node.body;
		const index = body.indexOf(lastNode);
		return {
			node: path.node,
			index: index
		};
	} else {
		return getHoistedNode(path.node, path.parentPath);
	}
}

function hasHyphenOrColon(attr) {
	return attr.indexOf('-') !== -1 || attr.indexOf(':') !== -1;
}

function applyKeyToNode(t, node, key) {
	return t.callExpression(
		t.memberExpression(node, t.identifier('key')), (
			[key]
		)
	);
}

function applyRefToNode(t, node, ref) {
	return t.callExpression(
		t.memberExpression(node, t.identifier('ref')), (
			[ref]
		)
	);
}

function createHooksObject(t, hooks) {
	if (hooks) {
		if (Array.isArray(hooks)) {
			if (hooks.length > 0) {
				return t.ObjectExpression(hooks.map(
					({ name, value, spread }) => spread ? t.SpreadProperty(name) : t.ObjectProperty(name, value)
				))
			}
		} else {
			return hooks;
		}
	}
	return t.identifier('null');
}

function createPropsObject(t, props) {
	if (props.length === 1 && props[0].spread) {
		return props[0].name;
	} else {
		return t.ObjectExpression(props.map(
			({ name, value, spread }) => spread ? t.SpreadProperty(name) : t.ObjectProperty(name, value)
		));
	}
}

function createVElement(t, tag, key, ref, props, children, childrenType) {
	const args = [
		t.StringLiteral(tag)
	];

	if (props && props.length > 0) {
		args.push(createPropsObject(t, props));
	} else {
		args.push(t.identifier('null'));
	}
	if (children && children.length > 0) {
		if (children.length > 1) {
			args.push(t.arrayExpression(children));
		} else {
			args.push(children[0]);
		}
	} else {
		args.push(t.identifier('null'));
	}
	if (key) {
		args.push(key);
	} else {
		args.push(t.identifier('null'));
	}
	if (ref) {
		args.push(ref);
	} else {
		args.push(t.identifier('null'));
	}
	if (childrenType) {
		args.push(childrenType);
	} else {
		args.push(t.identifier('null'));
	}	

	return t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVElement')), args);
}

function createVComponent(t, component, key, ref, props, hooks) {
	const args = [
		component
	];

	if (props && props.length > 0) {
		args.push(createPropsObject(t, props));
	} else {
		args.push(t.identifier('null'));
	}
	if (key) {
		args.push(key);
	} else {
		args.push(t.identifier('null'));
	}
	args.push(createHooksObject(t, hooks));
	if (ref) {
		args.push(ref);
	} else {
		args.push(t.identifier('null'));
	}
	return t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVComponent')), args);
}

function createChildren(t, nodeChildren, args, params, templateState, parentIsComponent) {
	const children = [];

	for (let i = 0; i < nodeChildren.length; i++) {
		const { node } = createNode(t, nodeChildren[i], args, params, templateState, false, parentIsComponent);

		if (node) {
			children.push(node);
		}
	}
	if (children.length === 1) {
		return children;
	} else {
		return children;
	}
}

function isStaticLiteralType(type) {
	switch (type) {
		case 'NumericLiteral':
		case 'StringLiteral':
		case 'BooleanLiteral':
			return true;
		default:
			return false;
	}
}

function createTemplateProps(t, attributes, args, params, templateState, component) {
	let props = [];
	let hooks = null;
	let key = null;
	let childrenType = null;
	let ref = null;
	// need to optimise this really
	const hasSpreadProps = attributes.some(({ type }) => type === 'JSXSpreadAttribute');

	attributes.forEach(attribute => {
		switch (attribute.type) {
			case 'JSXSpreadAttribute':
				const spread = attribute.argument;

				props.push({ name: spread, value: null, spread: true });
				break;
			case 'JSXAttribute':
				let name = attribute.name;
				const type = name.type;
				let staticProp = false;

				if (type === 'JSXIdentifier') {
					name = name.name;
				} else if (type === 'JSXNamespacedName') {
					name = name.namespace.name + ':' + name.name.name;
				} else {
					debugger;
				}
				let value = attribute.value;

				if (value) {
					if (value.type === 'JSXExpressionContainer') {
						const expression = value.expression;

						value = expression;
						if (isStaticLiteralType(expression.type)) {
							staticProp = true;
							templateState.hash += `|prop:${ name }=${ expression.value }`;
						}
					} else if (value.type === 'StringLiteral') {
						value = t.StringLiteral(value.value);
						staticProp = true;
						templateState.hash += `|prop:${ name }='${ value.value }'`;
					} else {
						debugger;
					}
				} else {
					staticProp = true;
					value = t.booleanLiteral(true);
					templateState.hash += `|prop:${ name }=true`;
				}
				if (name === 'key') {
					if (params && !staticProp && !component) {
						const param = 'key' + templateState.key++;

						args.push(value);
						params.push(param);
						key = t.identifier(param);
						templateState.hash += `|prop:key=${ param }`;
					} else {
						key = value;
					}
				} else if (name === 'ref') {
					if (params && !staticProp && !component) {
						const param = 'ref' + templateState.ref++;

						args.push(value);
						params.push(param);
						ref = t.identifier(param);
						templateState.hash += `|prop:ref=${ param }`;
					} else {
						ref = value;
					}
				} else if (name === 'childrenType' && !component) {
					childrenType = value;
					templateState.hash += `|prop:childrenType=${ expressionToString(value) }`;
				} else if (name === 'hooks' && component) {
					if (hooks) {
						throw new Error('Dynamic hooks cannot be mixed with static hooks');
					}
					hooks = value;
				} else if (name.substr(0, 11) === 'onComponent' && component) {
					if (!hooks) {
						hooks = [];
					} else if (!Array.isArray(hooks)) {
						throw new Error('Dynamic hooks cannot be mixed with static hooks');
					}
					name = t.identifier(name);
					hooks.push({ name, value, spread: false });
				} else {
					name = hasHyphenOrColon(name) ? t.StringLiteral(name) : t.identifier(name);
					if (params && !staticProp && !component && !hasSpreadProps) {
						const param = 'prop' + templateState.props++;

						args.push(value);
						params.push(param);
						props.push({ name, value: t.identifier(param), spread: false });
						templateState.hash += `|prop:${ name.name }=${ param }`;
					} else {
						props.push({ name, value, spread: false });
					}
				}
				break;
			default:
				debugger;
		}
	});
	if (!component && hasSpreadProps) {
		const param = 'spreadProp' + templateState.props++;

		args.push(createPropsObject(t, props));
		props = [{ name: t.identifier(param), value: null, spread: true }];
		params.push(param);
		templateState.hash += `|props='${ param }'`;
	}
	return { props, hooks, key, ref, childrenType };
}

function expressionToString(exp, str) {
	if (exp.object && exp.property) {
		return expressionToString(exp.object) + '.' + expressionToString(exp.property);
	} else if (exp.property) {
		return exp.property.name;
	} else if (exp.name) {
		return exp.name;
	} else if (exp.value) {
		return exp.value;
	}
}

function createNode(t, node, args, params, templateState, isRoot, parentIsComponent) {
	switch (node.type) {
		case 'JSXElement':
			const openingElement = node.openingElement;
			const attributes = openingElement.attributes;
			let name = openingElement.name;
			let component = false;
			const type = name.type;

			if (type === 'JSXIdentifier') {
				if (isComponent(name.name)) {
					component = true;
					templateState.hash += `|component:${ name.name }`;
				} else {
					name = name.name;
					templateState.hash += `|element:'${ name }'`;
				}
			} else if (type === 'JSXMemberExpression') {
				templateState.hash += `|component:${ expressionToString(name) }`;
				component = true;
			}
			const { props, key, ref, hooks, childrenType } = createTemplateProps(t, attributes, args, params, templateState, component);

			if (component) {
				const children = createChildren(t, node.children, args, params, templateState, true);

				if (children && children.length > 0) {
					props.push({
						name: t.identifier('children'),
						value: children.length > 1 ? t.arrayExpression(children) : children[0]
					});
				}
				if (params && !isRoot && !parentIsComponent) {
					const param = 'comp' + templateState.component++;

					params.push(param);
					args.push(createVComponent(t, name, key, ref, props, hooks));
					templateState.hash += `|'${ param }'`;
					return { skipTemplate: false, node: t.identifier(param) };
				} else {
					return { skipTemplate: true, node: createVComponent(t, name, key, ref, props, hooks) };
				}
			} else {
				const hasChildren = node.children.length > 0;

				templateState.hash += hasChildren ? `|[children` : '';
				const children = createChildren(t, node.children, args, params, templateState, parentIsComponent);

				templateState.hash += hasChildren ? `]'` : '';
				return { skipTemplate: false, node: createVElement(t, name, key, ref, props, children, childrenType) };
			}
		case 'JSXText':
			const text = handleWhiteSpace(node.value);

			if (text !== '') {
				templateState.hash += `|text:'${ text }'`;
				return { skipTemplate: false, node: t.StringLiteral(text) };
			}
			return { skipTemplate: false, node: null };
		case 'JSXExpressionContainer':
			const expression = node.expression;

			if (params && !isStaticLiteralType(expression.type) && !parentIsComponent) {
				const param = 'child' + templateState.children++;

				args.push(expression);
				params.push(param);
				templateState.hash += `|'${ param }'`;
				return { skipTemplate: false, node: t.identifier(param) };
			}
			templateState.hash += `|'${ expressionToString(expression) }'`;
			return { skipTemplate: false, node: expression };
		default:
			return { skipTemplate: false, node: null };
	}
}

module.exports = function (options) {
	const t = options.types;

	return {
		visitor: {
			JSXElement: {
				enter(path, scope) {
					const opts = scope.opts;

					if (!opts.counter) {
						opts.counter = {
							id: 0
						};
					}
					if (!opts.hashMap) {
						opts.hashMap = new Map();
					}
					const args = [];
					const params = [];
					const templateState = {
						key: 0,
						props: 0,
						children: 0,
						component: 0,
						ref: 0,
						hooks: 0,
						hash: 'tpl'
					};
					const { skipTemplate, node } = createNode(t, path.node, args, params, templateState, true, false);
					const hash = templateState.hash;
					const hashMapId = opts.hashMap.get(hash);
					const id = hashMapId === undefined ? opts.counter.id : hashMapId;

					if (skipTemplate) {
						path.replaceWith(node);
					} else {
						path.replaceWith(t.callExpression(t.identifier('tpl' + id), args));
						if (hashMapId === undefined) {
							opts.hashMap.set(hash, id);
							addTemplateToModule(t, getHoistedNode(path.node, path.parentPath), node, id, params, opts.pragma, opts.pragmaMethod);
							opts.counter.id++;
						}
					}
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

