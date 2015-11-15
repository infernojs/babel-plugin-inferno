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

function processAttributes(t, attributes, root, templateElem) {
	for(var i = 0; i < attributes.length; i++) {
		var attribute = attributes[i];

		if(attribute.type === 'JSXAttribute') {
			var attrName = attribute.name.name;
			var expression = attribute.value.expression;

			if(expression !== undefined) {
				if (expression.type === 'Literal') {
					templateElem.attrs[attrName] = expression.value;
					root.templateString += expression.value + "|-|";
				} else {
					var index = root.templateValues.length;

					root.templateString += "$$|";
					root.expressionMap[expression] = index;
					root.templateValues.push(expression);
					templateElem.attrs[attrName] = {
						index: index
					};
				}
			} else if (attribute.value.type === 'Literal') {
				templateElem.attrs[attrName] = attribute.value.value;
				root.templateString += attribute.value.value + "|-|";
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
				}

			} else {
				var index = root.templateValues.length;
				root.expressionMap[tagName] = index;
				root.templateValues.push(t.identifier(tagName));
				templateElem = {
					component: {
						index: index
					},
					children: null,
					attrs: {}
				}
			}

			if(element.openingElement.attributes && element.openingElement.attributes.length > 0) {
				processAttributes(t, element.openingElement.attributes, root, templateElem);
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
		var index = root.templateValues.length;

		root.templateString += "$$|";
		root.expressionMap[element.expression] = index;
		root.templateValues.push(element.expression);
		parentTemplateElem.children.push({
			index: index
		});
	} else if (element.type === "Literal") {
		parentTemplateElem.children.push(element.value);
		root.templateValues.push(element);
		root.templateString += element.value + "|";
	} else if (element.type === "JSXText") {
		parentTemplateElem.children.push(element.value);
		root.templateString += element.value + "|";
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

					if (root.templateValues.length === 1) {
						values = t.toExpression(expressions[0]);
					} else if(root.templateValues.length > 1) {
						values = t.arrayExpression(expressions);
					}

					if (!opts.roots) {
						opts.roots = {};
					}
					opts.roots[root.templateKey] = root;

					path.replaceWith(
						t.ExpressionStatement(t.callExpression(
							t.memberExpression(t.identifier("Inferno"), t.identifier("createFragment")),
							[values, t.identifier(root.templateKey)]
						))
					);
				}
			}
		},
		inherits: require("babel-plugin-syntax-jsx")
	}
};

