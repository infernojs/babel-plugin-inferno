"use strict";

var toReference = require('./helpers/to-reference');
var flattenExpressions = require('./helpers/flatten-expressions');
var createTemplateKey = require('./createTemplateKey');
var addTemplatesToModule = require('./addTemplatesToModule');
var isArray = require('./helpers/is-array');

function nullObject() {
  return Object.create(null);
}

function setupInjector(program, parent, scope, file) {
	file.setDynamic(namespace, nullObject);
}

function isComponent(name) {
	return name.charAt(0).toUpperCase() === name.charAt(0);
}

//skip passing them as values
var literalTypes = {
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
	if ( attributes && (attributes.length ) ) {
		var props = [];

		for (var i = 0; i < attributes.length; i++) {
			var attribute = attributes[i];
			var attrName = attribute.name.name;

			if (attribute.type === 'JSXAttribute') {
				var expression = attribute.value.expression;

				if (expression !== undefined) {
					if (literalTypes[expression.type]) {
						root.templateString += attrName + "=" + expression.value + "|-|";
						templateElem.attrs[attrName] = expression.value;
					} else if (expression.type === "NullLiteral") {
						root.templateString += attrName + "=null|-|";
						templateElem.attrs[attrName] = null;

					} else if (expression.type === "BinaryExpression"
						&& literalTypes[expression.left.type] && literalTypes[expression.right.type]) {

						root.templateString += attrName + "=" + expression.left.value + " " + expression.operator + " " + expression.right.value + "|-|";
						templateElem.attrs[attrName] = expression;
					} else {
						var index = root.templateValues.length;

						root.templateString += attrName + "=$$|";
						root.expressionMap[expression] = index;
						root.templateValues.push(expression);
						templateElem.attrs[attrName] = {
							index: index
						};
					}
				} else if (literalTypes[attribute.value.type]) {
					root.templateString += attrName + "=" + attribute.value.value + "|-|";
					templateElem.attrs[attrName] = attribute.value.value;
				} else if (attribute.value.type === "NullLiteral") {
					root.templateString += attrName + "=null|-|";
					templateElem.attrs[attrName] = null;
				}
			} else if (attribute.type === 'JSXSpreadAttribute') {
				var argument = attribute.argument;
				var index = root.templateValues.length;

				root.templateString += attrName + "=" + "$$|";
				root.expressionMap[argument] = index;
				root.templateValues.push(argument);
				templateElem.attrs = {
					index: index
				};
			}
		}
	}
}

function processElement(t, element, root, parentTemplateElem) {
	if (element.type === "JSXElement") {
		if (element.openingElement) {
			var tagName = element.openingElement.name.name;
			var templateElem;

			if (!isComponent(tagName)) {
				templateElem = {
					tag: tagName,
					children: null,
					attrs: {}
				};

				if (element.openingElement.attributes && element.openingElement.attributes.length > 0) {
					processAttributes(t, element.openingElement.attributes, root, templateElem);
				}
			} else {
				var index = root.templateValues.length;
				root.expressionMap[tagName] = index;
				root.templateValues.push(
					t.identifier(tagName)
				);

				templateElem = {
					tag: {
						index: index
					},
					attrs: {},
					children: null
				};

				if (element.openingElement.attributes && element.openingElement.attributes.length > 0) {
					processAttributes(t, element.openingElement.attributes, root, templateElem);
				}
			}

			root.templateString += tagName + "|";
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
	} else if (element.type === "JSXExpressionContainer") {
		if (element.expression.type === 'StringLiteral') {
			parentTemplateElem.children.push(element.expression.value);
			root.templateString += element.expression.value + "|";
		} else {
			var index = root.templateValues.length;

			root.templateString += "$$|";
			root.expressionMap[element.expression] = index;
			root.templateValues.push(element.expression);
			parentTemplateElem.children.push({
				index: index
			});
		}
	} else if (element.type === "Literal") {
		parentTemplateElem.children.push(element.value);
		root.templateString += element.value + "|";
	} else if (element.type === "JSXText") {
		var text = handleWhiteSpace(element.value);
		if(text != '') {
			parentTemplateElem.children.push(text);
			root.templateString += text + "|";
		}
	}
}

function processChildren(t, children, root, parentTemplateElem) {
	if(children && ( children.length )) {
		for(var i = 0; i < children.length; i++) {
			var child = children[i];
			processElement(t, child, root, parentTemplateElem);
		}
	}
}

function getHoistedNode(lastNode, path) {
	if (path.parentPath === null) {
		var body = path.node.body;
		var index = body.indexOf(lastNode);
		return {node: path.node, index: index};
	} else {
		return getHoistedNode(path.node, path.parentPath);
	}
}

module.exports = function(options) {
	var t = options.types;

	return {
		visitor : {
			JSXElement: {
				enter: function(path, scope) {
					var opts = scope.opts;
					var node = path.node;

					if (node.root !== undefined) {
						return;
					}

					var root = {
						templateValues: [],
						templateElem: null,
						templateString: "",
						templateKey: null,
						expressionMap: {}
					};

					processElement(t, node, root, null);
					//create the templateKey
					root.templateKey = "tpl" + createTemplateKey(root.templateString);

					var values = t.identifier('null');

					if (root.templateValues.length && ( root.templateValues.length > 0 )) {
						values = root.templateValues;
					}
					if (!opts.roots) {
						opts.roots = {};
					}
					opts.roots[root.templateKey] = root;

					path.replaceWith(
						t.ExpressionStatement(t.callExpression(
							t.identifier(root.templateKey),
							isArray(values) ? values.map(function(value) {
								return t.toExpression(value);
							}) : [values]
						))
					);

					addTemplatesToModule(t, getHoistedNode(path.node, path.parentPath), root.templateKey, root);
				}
			}
		},
		inherits: require("babel-plugin-syntax-jsx")
	}
};

