'use strict';

const createTemplateKey = require('./createTemplateKey');
const addTemplatesToModule = require('./addTemplatesToModule');
const constructTemplates = require('./constructTemplates');
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

function isAttrAnEvent(attr) {
	return attr[0] === 'o' && attr[1] === 'n' && attr.length > 3;
}

function isAttrAHook(hook) {
	return hook === 'onCreated'
		|| hook === 'onAttached'
		|| hook === 'onWillDetach'
		|| hook === 'onWillUpdate'
		|| hook === 'onDidUpdate';
}

function isAttrAComponentHook(hook) {
	return hook === 'onComponentWillMount'
		|| hook === 'onComponentDidMount'
		|| hook === 'onComponentWillUnmount'
		|| hook === 'onComponentShouldUpdate'
		|| hook === 'onComponentWillUpdate'
		|| hook === 'onComponentDidUpdate';
}

function processAttributes(t, attributes, root, templateElem) {
	let property = 'attrs';

	if (attributes && attributes.length) {
		templateElem.staticAttrs = true;
		for (let i = 0; i < attributes.length; i++) {
			const attribute = attributes[i];
			let attrName;

			// JSXSpreadAttribute attribute
			if (attribute.type === 'JSXSpreadAttribute') {
				const name = attribute.argument.name;

				root.templateString += name + '=$$|';
				if (!templateElem.spread) {
					templateElem.spread = {};
				}
				templateElem.spread[name] = true;
				templateElem.staticAttrs = false;
				continue;
			} else if (attribute.name.type === 'JSXNamespacedName') {
				attrName = attribute.name.namespace.name + ':' + attribute.name.name.name;
			} else {
				attrName = attribute.name.name;
			}
			if (templateElem.isComponent && isAttrAComponentHook(attrName)) {
				property = 'hooks';
				attrName = 'c' + attrName.substring(3);
			} else if (!templateElem.isComponent && isAttrAHook(attrName)) {
				property = 'hooks';
				attrName = attrName[2].toLowerCase() + attrName.substring(3);
			} else if (!templateElem.isComponent && isAttrAnEvent(attrName)) {
				property = 'events';
				attrName = attrName.toLowerCase();
			} else {
				property = 'attrs';
			}
			if (attribute.type === 'JSXAttribute') {
				const value = attribute.value;

				if (value) {
					const expression = value.expression;

					if (expression !== undefined) {
						if (literalTypes[expression.type]) {
							root.templateString += attrName + '=' + expression.value + '|-|';
							templateElem[property][attrName] = expression;
						} else if (expression.type === 'NullLiteral') {
							root.templateString += attrName + '=null|-|';
							templateElem[property][attrName] = null;
							templateElem.staticAttrs = false;
						} else if (expression.type === 'BinaryExpression'
							&& literalTypes[expression.left.type] && literalTypes[expression.right.type]) {

							root.templateString += attrName + '=' + expression.left.value + ' ' + expression.operator + ' ' + expression.right.value + '|-|';
							templateElem[property][attrName] = expression;
						} else {
							root.templateString += attrName + '=$$|';
							templateElem[property][attrName] = expression;
							templateElem.staticAttrs = false;
						}
					} else if (literalTypes[attribute.value.type]) {
						root.templateString += attrName + '=' + attribute.value.value + '|-|';
						templateElem[property][attrName] = attribute.value.value;
					} else if (attribute.value.type === 'NullLiteral') {
						root.templateString += attrName + '=null|-|';
						templateElem[property][attrName] = null;
					}
				} else {
					root.templateString += attrName + '=true|-|';
					templateElem[property][attrName] = true;
				}
			}
		}
	}
}

function processElement(t, element, root, parentTemplateElem, counter) {
	if (element.type === 'JSXElement') {
		if (element.openingElement) {
			const tagName = element.openingElement.name;
			let templateElem;

			if (!isComponent(tagName.name)) {
				templateElem = {
					tag: t.StringLiteral(tagName.name),
					children: null,
					attrs: {},
					events: {},
					hooks: {},
					id: counter.id++
				};

				if (element.openingElement.attributes && element.openingElement.attributes.length > 0) {
					processAttributes(t, element.openingElement.attributes, root, templateElem);
				}
			} else {
				templateElem = {
					tag: tagName,
					attrs: {},
					hooks: {},
					children: null,
					isComponent: true,
					id: counter.id++
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
				processChildren(t, element.children, root, templateElem, counter);
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

function processChildren(t, children, root, parentTemplateElem, counter) {
	if (children && children.length) {
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			processElement(t, child, root, parentTemplateElem, counter);
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
					if (!opts.counter) {
						opts.counter = {
							id: 0
						};
					}
					const counter = opts.counter;
					processElement(t, node, root, null, counter);

					const templates = {};
					const templateCalls = constructTemplates(t, root.templateElem, templates);

					path.replaceWith(templateCalls);
					addTemplatesToModule(t, getHoistedNode(path.node, path.parentPath), templates, opts.pragma, opts.pragmaMethod);
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

