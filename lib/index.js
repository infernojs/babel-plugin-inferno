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

function applyHooksToNode(t, node, hooks) {
	if (Array.isArray(hooks)) {
		if (hooks.length > 0) {
			return t.callExpression(
				t.memberExpression(node, t.identifier('hooks')), (
					[t.ObjectExpression(hooks.map(
						({ name, value, spread }) => spread ? t.SpreadProperty(name) : t.ObjectProperty(name, value)
					))]
				)
			);
		}
	} else {
		return t.callExpression(
			t.memberExpression(node, t.identifier('hooks')), (
				[hooks]
			)
		);
	}
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

function applyPropsToNode(t, node, props) {
	return t.callExpression(
		t.memberExpression(node, t.identifier('props')), (
			[createPropsObject(t, props)]
		)
	);
}

function createVElement(t, tag, key, ref, props, children, childrenType) {
	let node = t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVElement')), [
		t.StringLiteral(tag)
	]);
	if (key) {
		node = applyKeyToNode(t, node, key);
	}
	if (ref) {
		node = applyRefToNode(t, node, ref);
	}
	if (props && props.length > 0) {
		node = applyPropsToNode(t, node, props);
	}
	if (children && children.length > 0) {
		node = t.callExpression(
			t.memberExpression(node, t.identifier('children')), (
				children.length > 1 ? [t.arrayExpression(children)] : children
			)
		);
	}
	if (childrenType) {
		node = t.callExpression(
			t.memberExpression(node, t.identifier('childrenType')), (
				[childrenType]
			)
		);
	}
	return node;
}

function createVComponent(t, component, key, ref, props, hooks) {
	let node = t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVComponent')), [
		component
	]);

	if (key) {
		node = applyKeyToNode(t, node, key);
	}
	if (ref) {
		node = applyRefToNode(t, node, ref);
	}
	if (hooks) {
		node = applyHooksToNode(t, node, hooks);
	}
	if (props && props.length > 0) {
		node = applyPropsToNode(t, node, props);
	}
	return node;
}

function createChildren(t, nodeChildren, args, params, templateIndexes) {
	const children = [];

	for (let i = 0; i < nodeChildren.length; i++) {
		const { node } = createNode(t, nodeChildren[i], args, params, templateIndexes, false);

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

function createTemplateProps(t, attributes, args, params, templateIndexes, component) {
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
						}
					} else if (value.type === 'StringLiteral') {
						value = t.StringLiteral(value.value);
						staticProp = true;
					} else {
						debugger;
					}
				} else {
					value = t.booleanLiteral(true);
				}
				if (name === 'key') {
					if (params && !staticProp && !component) {
						const param = 'key' + templateIndexes.key++;

						args.push(value);
						params.push(param);
						key = t.identifier(param);
					} else {
						key = value;
					}
				} else if (name === 'ref') {
					if (params && !staticProp && !component) {
						const param = 'ref' + templateIndexes.ref++;

						args.push(value);
						params.push(param);
						ref = t.identifier(param);
					} else {
						ref = value;
					}
				} else if (name === 'childrenType' && !component) {
					childrenType = value;
				} else if (name === 'hooks' && component) {
					if (hooks) {
						throw new Error('Dynamic hooks cannot be mixed with static hooks');
					}
					hooks = value;
				} else if (name.substr(0, 3) === 'onC' && component) {
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
						const param = 'prop' + templateIndexes.props++;

						args.push(value);
						params.push(param);
						props.push({ name, value: t.identifier(param), spread: false });
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
		const param = 'spreadProp' + templateIndexes.props++;

		args.push(createPropsObject(t, props));
		props = [{ name: t.identifier(param), value: null, spread: true }];
		params.push(param);
	}
	return { props, hooks, key, ref, childrenType };
}

function createNode(t, node, args, params, templateIndexes, isRoot) {
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
				} else {
					name = name.name;
				}
			} else if (type === 'JSXMemberExpression') {
				component = true;
			}
			const { props, key, ref, hooks, childrenType } = createTemplateProps(t, attributes, args, params, templateIndexes, component);

			if (component) {
				const children = createChildren(t, node.children, null, null);

				if (children && children.length > 0) {
					props.push({
						name: t.identifier('children'),
						value: children.length > 1 ? t.arrayExpression(children) : children[0]
					});
				}
				if (params && !isRoot) {
					const param = 'comp' + templateIndexes.component++;

					params.push(param);
					args.push(createVComponent(t, name, key, ref, props, hooks));
					return { skipTemplate: false, node: t.identifier(param) };
				} else {
					return { skipTemplate: true, node: createVComponent(t, name, key, ref, props, hooks) };
				}
			} else {
				const children = createChildren(t, node.children, args, params, templateIndexes);

				return { skipTemplate: false, node: createVElement(t, name, key, ref, props, children, childrenType) };
			}
		case 'JSXText':
			const text = handleWhiteSpace(node.value);

			if (text !== '') {
				return { skipTemplate: false, node: t.StringLiteral(text) };
			}
			return { skipTemplate: false, node: null };
		case 'JSXExpressionContainer':
			const expression = node.expression;

			if (params && !isStaticLiteralType(expression.type)) {
				const param = 'child' + templateIndexes.children++;

				args.push(expression);
				params.push(param);
				return { skipTemplate: false, node: t.identifier(param) };
			}
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
					const args = [];
					const params = [];
					const templateIndexes = {
						key: 0,
						props: 0,
						children: 0,
						component: 0,
						ref: 0,
						hooks: 0
					};
					const { skipTemplate, node } = createNode(t, path.node, args, params, templateIndexes, true);

					if (!opts.counter) {
						opts.counter = {
							id: 0
						};
					} else {
						opts.counter.id++;
					}
					const id = opts.counter.id;

					if (skipTemplate) {
						path.replaceWith(node);
					} else {
						path.replaceWith(t.callExpression(t.identifier('tpl' + id), args));
						addTemplateToModule(t, getHoistedNode(path.node, path.parentPath), node, id, params, opts.pragma, opts.pragmaMethod);
					}
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

