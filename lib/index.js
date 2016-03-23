'use strict';

const createTemplateKey = require('./createTemplateKey');
const addTemplatesToModule = require('./addTemplatesToModule');
const constructTemplateNode = require('./constructTemplateNode');
const isComponent = require('./helpers/is-component');

function nullObject() {
	return Object.create(null);
}

function setupInjector(program, parent, scope, file) {
	file.setDynamic(namespace, nullObject);
}

// skip passing them as values
const literalTypes = {
	Literal: true,
	StringLiteral: true,
	NumericLiteral: true,
	BooleanLiteral: true
};

function handleWhiteSpace(str) {
	str = str.replace(/\t/g, '');
	str = str.replace(/(\s*[\r\n]\s*)/g, '');
	return str;
}

function processAttributes(t, attributes, root, templateElem) {
	if (attributes && attributes.length) {
		for (let i = 0; i < attributes.length; i++) {
			const attribute = attributes[i];
			const attrName = attribute.name.name;

			if (attribute.type === 'JSXAttribute') {
				const expression = attribute.value.expression;

				if (expression !== undefined) {
					if (literalTypes[expression.type]) {
						root.templateString += attrName + '=' + expression.value + '|-|';
						templateElem.attrs[attrName] = expression;
					} else if (expression.type === 'NullLiteral') {
						root.templateString += attrName + '=null|-|';
						templateElem.attrs[attrName] = null;

					} else if (expression.type === 'BinaryExpression'
						&& literalTypes[expression.left.type] && literalTypes[expression.right.type]) {

						root.templateString += attrName + '=' + expression.left.value + ' ' + expression.operator + ' ' + expression.right.value + '|-|';
						templateElem.attrs[attrName] = expression;
					} else {
						root.templateString += attrName + '=$$|';
						templateElem.attrs[attrName] = expression;
					}
				} else if (literalTypes[attribute.value.type]) {
					root.templateString += attrName + '=' + attribute.value.value + '|-|';
					templateElem.attrs[attrName] = attribute.value.value;
				} else if (attribute.value.type === 'NullLiteral') {
					root.templateString += attrName + '=null|-|';
					templateElem.attrs[attrName] = null;
				}
			} else if (attribute.type === 'JSXSpreadAttribute') {
				const argument = attribute.argument;

				root.templateString += attrName + '=' + '$$|';
				templateElem.attrs = argument;
			}
		}
	}
}

function processElement(t, element, root, parentTemplateElem) {
	if (element.type === 'JSXElement') {
		if (element.openingElement) {
			const tagName = element.openingElement.name;
			let templateElem;

			if (!isComponent(tagName.name)) {
				templateElem = {
					tag: t.StringLiteral(tagName.name),
					children: null,
					attrs: {}
				};

				if (element.openingElement.attributes && element.openingElement.attributes.length > 0) {
					processAttributes(t, element.openingElement.attributes, root, templateElem);
				}
			} else {
				templateElem = {
					tag: tagName,
					attrs: {},
					children: null,
					instance: null
				};

				if (element.openingElement.attributes && element.openingElement.attributes.length > 0) {
					processAttributes(t, element.openingElement.attributes, root, templateElem);
				}
			}

			root.templateString += tagName + '|';
			if (!root.templateElem) {
				root.templateElem = templateElem;
			}
			if (!element.selfClosing) {
				templateElem.children = [];
				processChildren(t, element.children, root, templateElem);
			}
			if (parentTemplateElem) {
				parentTemplateElem.children.push(templateElem);
			}
		}
	} else if (element.type === 'JSXExpressionContainer') {
		if (element.expression.type === 'StringLiteral') {
			parentTemplateElem.children.push(element.expression.value);
			root.templateString += element.expression.value + '|';
		} else {
			root.templateString += '$$|';
			parentTemplateElem.children.push(element.expression);
		}
	} else if (element.type === 'Literal') {
		parentTemplateElem.children.push(element.value);
		root.templateString += element.value + '|';
	} else if (element.type === 'JSXText') {
		const text = handleWhiteSpace(element.value);
		if (text !== '') {
			parentTemplateElem.children.push(text);
			root.templateString += text + '|';
		}
	}
}

function processChildren(t, children, root, parentTemplateElem) {
	if (children && children.length) {
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			processElement(t, child, root, parentTemplateElem);
		}
	}
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

module.exports = function (options) {
	const t = options.types;

	return {
		visitor: {
			JSXElement: {
				enter(path, scope) {
					const opts = scope.opts;
					let node = path.node;

					if (node.root !== undefined) {
						return;
					}

					const root = {
						templateElem: null,
						templateString: '',
						templateKey: null
					};

					processElement(t, node, root, null);
					// create the templateKey
					root.templateKey = 'tpl' + createTemplateKey(root.templateString);

					// const values = t.identifier('null');

					if (!opts.roots) {
						opts.roots = {};
					}
					opts.roots[root.templateKey] = root;

					/*
					path.replaceWith(
						t.ExpressionStatement(t.callExpression(
							t.identifier(root.templateKey),
							isArray(values) ? values.map(function(value) {
								return t.toExpression(value);
							}) : [values]
						))
					);
					*/

					node = constructTemplateNode(t, root.templateElem, true);

					node.properties.push(t.ObjectProperty(t.identifier('dom'), t.identifier('null')));

					path.replaceWith(
						node
					);

					// addTemplatesToModule(t, getHoistedNode(path.node, path.parentPath), root.templateKey, root);
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

