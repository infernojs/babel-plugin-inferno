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

function createVElement(t, tag, key, props, children, childrenType) {
	let node = t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVElement')), [
		t.StringLiteral(tag)
	]);
	if (key) {
		node = t.callExpression(
			t.memberExpression(node, t.identifier('key')), (
				[key]
			)
		);
	}
	if (props && props.length > 0) {
		node = t.callExpression(
			t.memberExpression(node, t.identifier('props')), (
				[t.ObjectExpression(props.map(
					({ name, value }) => t.ObjectProperty(name, value)
				))]
			)
		);
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
	return node;
}

function createTemplateChildren(t, nodeChildren, args, params) {
	const children = [];

	for (let i = 0; i < nodeChildren.length; i++) {
		const child = createTemplateNode(t, nodeChildren[i], args, params);

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

function createTemplateProps(t, attributes, args, params) {
	let props = [];
	let key = null;
	let childrenType = null;

	attributes.forEach(attribute => {
		switch (attribute.type) {
			case 'JSXAttribute':
				let name = attribute.name;
				const type = name.type;

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
					} else {
						debugger;
					}
				} else {
					value = t.booleanLiteral(true);
				}
				switch (name) {
					case 'key':
						key = value;
						break;
					case 'childrenType':
						childrenType = value;
						break;
					default:
						name = hasHyphenOrColon(name) ? t.StringLiteral(name) : t.identifier(name);
						props.push({ name, value });
				}
				break;
			default:
				debugger;
		}
	});
	return { props, key, childrenType };
}

function createTemplateNode(t, node, args, params) {
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
			if (component) {
				const param = 'comp' + args.length;

				params.push(param);
				args.push(createVComponent(t, name, null, null));
				return t.identifier(param);
			} else {
				const children = createTemplateChildren(t, node.children, args, params);
				const { props, key, childrenType } = createTemplateProps(t, attributes, args, params);

				return createVElement(t, name, key, props, children, childrenType);
			}
		case 'JSXText':
			const text = node.value.trim();

			if (text !== '') {
				return t.StringLiteral(text);
			}
			return null;
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
					const template = createTemplateNode(t, path.node, args, params);

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

