'use strict';

const createTemplateKey = require('./createTemplateKey');
const addTemplateToModule = require('./addTemplateToModule');
const isComponent = require('./helpers/is-component');

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

function applyPropsToNode(t, node, props) {
	return t.callExpression(
		t.memberExpression(node, t.identifier('props')), (
			[t.ObjectExpression(props.map(
				({ name, value }) => t.ObjectProperty(name, value)
			))]
		)
	);
}

function createVElement(t, tag, key, props, children, childrenType) {
	let node = t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVElement')), [
		t.StringLiteral(tag)
	]);
	if (key) {
		node = applyKeyToNode(t, node, key);
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

function createVComponent(t, component, key, props) {
	let node = t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVComponent')), [
		component
	]);

	if (key) {
		node = applyKeyToNode(t, node, key);
	}
	if (props && props.length > 0) {
		node = applyPropsToNode(t, node, props);
	}
	return node;
}

function createChildren(t, nodeChildren, args, params, templateIndexes) {
	const children = [];

	for (let i = 0; i < nodeChildren.length; i++) {
		const child = createNode(t, nodeChildren[i], args, params, templateIndexes);

		if (child) {
			children.push(child);
		}
	}
	if (children.length === 1) {
		return children;
	} else {
		return children;
	}
}

function createTemplateProps(t, attributes, args, params, templateIndexes, component) {
	let props = [];
	let key = null;
	let childrenType = null;

	attributes.forEach(attribute => {
		switch (attribute.type) {
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
						value = value.expression;
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
					if (params) {
						const param = 'key' + templateIndexes.key++;

						args.push(value);
						params.push(param);
						key = t.identifier(param);
					} else {
						key = value;
					}
				} else if (name === 'childrenType' && !component) {
					childrenType = value;
				} else {
					name = hasHyphenOrColon(name) ? t.StringLiteral(name) : t.identifier(name);
					if (params && !staticProp) {
						const param = 'prop' + templateIndexes.props++;

						args.push(value);
						params.push(param);
						props.push({ name, value: t.identifier(param) });
					} else {
						props.push({ name, value });
					}
				}
				break;
			default:
				debugger;
		}
	});
	return { props, key, childrenType };
}

function createNode(t, node, args, params, templateIndexes) {
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
			const { props, key, childrenType } = createTemplateProps(t, attributes, args, params, templateIndexes, component);

			if (component) {
				const children = createChildren(t, node.children, null, null);

				if (children && children.length > 0) {
					props.push({
						name: t.identifier('children'),
						value: children.length > 1 ? t.arrayExpression(children) : children[0]
					});
				}
				if (params) {
					const param = 'comp' + templateIndexes.component++;

					params.push(param);
					args.push(createVComponent(t, name, key, props));
					return t.identifier(param);
				} else {
					return createVComponent(t, name, key, props);
				}
			} else {
				const children = createChildren(t, node.children, args, params, templateIndexes);

				return createVElement(t, name, key, props, children, childrenType);
			}
		case 'JSXText':
			const text = node.value.trim();

			if (text !== '') {
				return t.StringLiteral(text);
			}
			return null;
		case 'JSXExpressionContainer':
			const expression = node.expression;

			if (params) {
				const param = 'child' + templateIndexes.children++;

				args.push(expression);
				params.push(param);
				return t.identifier(param);
			}
			return expression;
		default:
			return null;
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
						component: 0
					};
					const template = createNode(t, path.node, args, params, templateIndexes);

					if (!opts.counter) {
						opts.counter = {
							id: 0
						};
					} else {
						opts.counter.id++;
					}
					const id = opts.counter.id;

					path.replaceWith(t.callExpression(t.identifier('tpl' + id), args));
					addTemplateToModule(t, getHoistedNode(path.node, path.parentPath), template, id, params, opts.pragma, opts.pragmaMethod);
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

