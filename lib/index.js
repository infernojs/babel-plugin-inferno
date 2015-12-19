"use strict";

var toReference = require('./helpers/to-reference');
var flattenExpressions = require('./helpers/flatten-expressions');
var createTemplateKey = require('./createTemplateKey');
var addTemplatesToModule = require('./addTemplatesToModule');

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
	if(str.indexOf("\n") !== -1) {
		var remove = str.substring(0, str.indexOf("\n")).trim();
		if(remove === '') {
			str = str.substring(str.indexOf("\n") + 1);
		}
		str = handleWhiteSpace(str);
	}
	return str;
}

function processAttributes(t, attributes, root, templateElem) {
	var props = [];

	for(var i = 0; i < attributes.length; i++) {
		var attribute = attributes[i];

		if(attribute.type === 'JSXAttribute') {
			var attrName = attribute.name.name;
			var expression = attribute.value.expression;

			if(expression !== undefined) {
				if (literalTypes[expression.type]) {
					root.templateString += expression.value + "|-|";
					templateElem.attrs[attrName] = expression.value;
				} else if (expression.type === "NullLiteral") {
					root.templateString += "null|-|";
					templateElem.attrs[attrName] = null;

				} else if (expression.type === "BinaryExpression"
					&& literalTypes[expression.left.type] && literalTypes[expression.right.type]) {

					root.templateString += expression.left.value + " " + expression.operator + " " + expression.right.value +  "|-|";
					templateElem.attrs[attrName] = expression;
				} else {
					var index = root.templateValues.length;

					root.templateString += "$$|";
					root.expressionMap[expression] = index;
					root.templateValues.push(expression);
					templateElem.attrs[attrName] = {
						index: index
					};
				}
			} else if (literalTypes[attribute.value.type]) {
				root.templateString += attribute.value.value + "|-|";
				templateElem.attrs[attrName] = attribute.value.value;
			} else if (attribute.value.type === "NullLiteral") {
				root.templateString += "null|-|";
				templateElem.attrs[attrName] = null;
			}
		} else if(attribute.type === 'JSXSpreadAttribute') {
			var argument = attribute.argument;
			var index = root.templateValues.length;

			root.templateString += "$$|";
			root.expressionMap[argument] = index;
			root.templateValues.push(argument);
			templateElem.attrs = {
				index: index
			};
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
	if(children) {
		for(var i = 0; i < children.length; i++) {
			var child = children[i];
			processElement(t, child, root, parentTemplateElem);
		}
	}
}

module.exports = function(options) {
	var t = options.types;

	return {
		visitor : {
			Program: {
				exit(path, scope) {
					var opts = scope.opts;
					var node = path.node;

					for(var templateKey in opts.roots) {
						var root = opts.roots[templateKey];
						addTemplatesToModule(t, node, templateKey, root);
					}
				}
			},
			JSXElement: {
				enter(path, scope) {
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
					root.templateKey =  "tpl" + createTemplateKey(root.templateString);

					var values = t.identifier('null');
					var expressions = flattenExpressions(t, root.templateValues);

					if (root.templateValues.length > 0) {
						values = root.templateValues;
					}
					if (!opts.roots) {
						opts.roots = {};
					}
					opts.roots[root.templateKey] = root;

					path.replaceWith(
						t.ExpressionStatement(t.callExpression(
							t.identifier(root.templateKey),
							values.map(function(value) {
								return t.toExpression(value);
							})
						))
					);
				}
			}
		},
		inherits: require("babel-plugin-syntax-jsx")
	}
};

