"use strict";

var namespace = "inferno-dom-helpers";
var toReference = require('./to-reference');
var flattenExpressions = require('./flatten-expressions');
var createTemplateKey = require('./createTemplateKey');

function nullObject() {
  return Object.create(null);
}

function setupInjector(program, parent, scope, file) {
	file.setDynamic(namespace, nullObject);
}

function processElement(element, root, parentTemplateElem) {
	if(element.type === "JSXElement") {
		if (element.openingElement) {
			var tagName = element.openingElement.name.name;
			var templateElem = {
				tag: tagName,
				children: null
			}
			root.templateString += tagName + "|";
			if (!root.templateElem) {
				root.templateElem = templateElem;
			}
			if (!element.selfClosing) {
				templateElem.children = [];
				prcoessChildren(element.children, root, templateElem);
			}
			if(parentTemplateElem) {
				parentTemplateElem.children.push(templateElem);
			}
		}
	} else if (element.type === "JSXExpressionContainer") {
		root.templateString += "$$|";
		root.templateValues.push(element.expression);
	}
}

function prcoessChildren(children, root, parentTemplateElem) {
	if(children) {
		for(var i = 0; i < children.length; i++) {
			var child = children[i];
			processElement(child, root, parentTemplateElem);
		}
	}
}

function constructTemplate(t, templateElem, parentElem, templateFunc, level, index, parentElemName) {
	var elemName;
	if(parentElem === null) {
		elemName = "root";
		//create the root: e.g. var root = Inferno.template.createElement("foo");
		templateFunc.push(t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(elemName),
					t.callExpression(t.identifier("Inferno.template.createElement"), [t.literal(templateElem.tag)])
				)
		]));
		//assign the root to the fragment.dom
		templateFunc.push(t.AssignmentExpression("=", t.identifier("fragment.dom"), t.identifier("root")));
		level = 0;
	} else {
		elemName = "child_" + level + "_" + index;
		templateFunc.push(t.variableDeclaration("var", [
			t.variableDeclarator(
				t.identifier(elemName),
				t.callExpression(t.identifier("Inferno.template.createElement"), [t.literal(templateElem.tag)])
			)
		]));
		templateFunc.push(
			t.toStatement(t.callExpression(t.identifier(parentElemName + ".appendChild"), [t.identifier(elemName)]))
		);
		level++;
	}

	if(templateElem.children) {
		for(var i = 0; i < templateElem.children.length; i++) {
			constructTemplate(t, templateElem.children[i], templateElem, templateFunc, level, i, elemName);
		}
	}
}

function addTemplatesToModule(t, node, templateKey, root) {
	var templateFunc = [];
	constructTemplate(t, root.templateElem, null, templateFunc);
	node.body.push(
		t.functionExpression(t.identifier(templateKey), [toReference(t, "fragment")], t.blockStatement(templateFunc))
	);
	node.body.push(
		t.toStatement(t.AssignmentExpression("=", t.identifier(templateKey + ".key"), t.literal(templateKey)))
	);
}

module.exports = function(options) {
	var Plugin = options.Plugin;
	var t = options.types;

	return new Plugin("inferno", { visitor : {
		Program: {
			exit(node, parent, scope, opts) {
				for(var templateKey in opts.roots) {
					var root = opts.roots[templateKey];
					addTemplatesToModule(t, node, templateKey, root);
				}
			}
		},

		JSXElement: {
      		enter(node, parent, scope, opts) {
				if(node.root !== undefined) {
					return;
				}

				var root = {
					templateValues: [],
					templateElem: null,
					templateString: "",
					templateKey: null
				};

				processElement(node, root, null);
				//create the templateKey
				root.templateKey =  "tpl" + createTemplateKey(root.templateString);

				var values = t.literal(null);
				var expressions = flattenExpressions(t, root.templateValues);

				if(root.templateValues.length === 1) {
					values = t.toExpression(expressions[0]);
				} else if(root.templateValues.length > 1) {
					values = t.arrayExpression(expressions);
				}

				if(!opts.roots) {
					opts.roots = {};
				}
				opts.roots[root.templateKey] = root;

				return t.callExpression(t.identifier("Inferno.createFragment"), [values, t.identifier(root.templateKey)]);
      		}
      	}
	}});
};