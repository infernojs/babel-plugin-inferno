var toReference = require('./helpers/to-reference');

var createElementExpression = "createElement";
var createTextNodeExpression = "createTextNode";
var createEmptyTextNodeExpression = "createEmptyTextNode()";
var createEmptyEmptyDiv = "createEmptyDiv()";
var addAttributesExpression = "addAttributes";
var appendChildExpression = "appendChild";

//t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.TEXT_DIRECT"))

function constructTemplateValue(t, templateElem, elemName, root, templateFunc, singleChild, parentElemName, level, index) {
	var valueName;
	var elementName;
	var typeName;

	if(root.templateValues && root.templateValues.length > 1) {
		valueName = "fragment.templateValues[" + templateElem.index + "]";
		elementName = "fragment.templateElements[" + templateElem.index + "]";
		typeName = "fragment.templateTypes[" + templateElem.index + "]";
	} else {
		valueName = "fragment.templateValue";
		elementName = "fragment.templateElement";
		typeName = "fragment.templateType";
	}

	if(singleChild) {
		templateFunc.push(
			t.IfStatement(
				t.binaryExpression("!==", t.identifier("typeof " + valueName), t.StringLiteral("object")),
				t.BlockStatement([
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elemName + ".textContent"), t.identifier(valueName))),
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName), t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.TEXT"))))
				]),
				t.BlockStatement([
					t.ExpressionStatement(
						t.AssignmentExpression("=", t.identifier(typeName), t.identifier(
							"(" + valueName + ".constructor === Array ? Inferno.FragmentValueTypes.LIST : Inferno.FragmentValueTypes.FRAGMENT)")
						)
					)
				])
			)
		);

		templateFunc.push(
			t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(elemName)))
		);
	} else {
		var newElemName = "child_" + level + "_" + index;
		templateFunc.push(
			t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(newElemName)
				)
			])
		);
		templateFunc.push(
			t.IfStatement(
				t.binaryExpression("!==", t.identifier("typeof " + valueName), t.StringLiteral("object")),
				t.BlockStatement([
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(newElemName), t.memberExpression(t.identifier("template"), t.identifier(createTextNodeExpression + `(${ valueName })`)))),
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName), t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.TEXT_DIRECT"))))
				]),
				t.BlockStatement([
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(newElemName), t.memberExpression(t.identifier("template"), t.identifier(createEmptyTextNodeExpression)))),
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName), t.identifier(
							"(" + valueName + ".constructor === Array ? Inferno.FragmentValueTypes.LIST_REPLACE : Inferno.FragmentValueTypes.FRAGMENT_REPLACE)")
					))
				])
			)
		);
		templateFunc.push(
			t.ExpressionStatement(
				t.callExpression(
					t.memberExpression(t.identifier(elemName), t.identifier(appendChildExpression)),
					[t.identifier(newElemName)]
				)
			)
		);

		templateFunc.push(
			t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(newElemName)))
		);
	}
}

function constructTemplateComponentValue(t, templateElem, elemName, templateFunc, root, parentElem, parentElemName) {
	var typeName;
	var elementName;
	if(root.templateValues.length > 1) {
		typeName = "fragment.templateTypes[" + templateElem.component.index + "]";
		elementName = "fragment.templateElements[" + templateElem.component.index + "]";
	} else {
		typeName = "fragment.templateType";
		elementName = "fragment.templateElement";
	}

	if(!parentElem || parentElem.children.length === 1) {
		templateFunc.push(
			t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName),
				t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.COMPONENT"))
			))
		);

		templateFunc.push(
			t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(parentElemName)))
		);
		return true;
	} else {
		templateFunc.push(t.variableDeclaration("var", [
			t.variableDeclarator(
				t.identifier(elemName),
				t.memberExpression(t.identifier("template"), t.identifier(createEmptyEmptyDiv))
			)
		]));

		templateFunc.push(
			t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName),
				t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.COMPONENT_REPLACE"))
			))
		);

		templateFunc.push(
			t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(elemName)))
		);
	}
	return false;
}

function constructTemplate(t, templateElem, parentElem, templateFunc, root, parentElemName, level, index) {
	var elemName;
	if (parentElem === null) {
		elemName = "root";
		//create the root: e.g. var root = Inferno.template.createElement("foo");
		if(templateElem.component) {
			var valueName;
			var elementName;
			var typeName;

			if(root.templateValues && root.templateValues.length > 1) {
				valueName = "fragment.templateValues[" + templateElem.index + "]";
				elementName = "fragment.templateElements[" + templateElem.index + "]";
				typeName = "fragment.templateTypes[" + templateElem.index + "]";
			} else {
				valueName = "fragment.templateValue";
				elementName = "fragment.templateElement";
				typeName = "fragment.templateType";
			}

			templateFunc.push(t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(elemName),
					t.memberExpression(t.identifier("template"), t.identifier(createEmptyEmptyDiv))
				)
			]));

			templateFunc.push(
				t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName),
					t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.COMPONENT_REPLACE"))
				))
			);

			templateFunc.push(
				t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(elemName)))
			);
		} else {
			templateFunc.push(t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(elemName),
					t.callExpression(t.memberExpression(t.identifier("template"), t.identifier(createElementExpression)), [t.StringLiteral(templateElem.tag)])
				)
			]));
		}
		//assign the root to the fragment.dom
		templateFunc.push(t.ExpressionStatement(t.AssignmentExpression("=", t.identifier("fragment.dom"), t.identifier("root"))));

		level = 0;
	} else {
		elemName = "child_" + level + "_" + index;
		if(templateElem.component) {
			if(constructTemplateComponentValue(t, templateElem, elemName, templateFunc, root, parentElem, parentElemName) === true) {
				elemName = parentElemName;
			}
		} else {
			templateFunc.push(t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(elemName),
					t.callExpression(t.memberExpression(t.identifier("template"), t.identifier(createElementExpression)), [t.StringLiteral(templateElem.tag)])
				)
			]));
		}
		level++;
	}

	if (templateElem.children) {
		var child;
		if (templateElem.children.length > 1) {
			for (var i = 0; i < templateElem.children.length; i++) {
				var child = templateElem.children[i];
				if (typeof child === "string") {
					if (child !== '') {
						templateFunc.push(
							t.ExpressionStatement(
								t.callExpression(
									t.memberExpression(t.identifier(elemName), t.identifier(appendChildExpression)),
									[t.memberExpression(t.identifier("template"), t.identifier(createTextNodeExpression + `("${ child }")`))]
								)
							)
						);
					}
				} else if (child.index !== undefined) {
					constructTemplateValue(t, child, elemName, root, templateFunc, false, parentElemName, level, i);
				} else {
					constructTemplate(t, templateElem.children[i], templateElem, templateFunc, root, elemName, level, i);
				}
			}
		} else if (typeof (child = templateElem.children[0]) !== "object") {
			if(child !== undefined) {
				templateFunc.push(
					t.ExpressionStatement(
						t.AssignmentExpression("=", t.identifier(elemName + ".textContent"), t.StringLiteral(templateElem.children[0]))
					)
				);
			}
		} else if (child.index !== undefined) {
			constructTemplateValue(t, child, elemName, root, templateFunc, true, parentElemName);
		} else if (typeof child !== "object") {
			//debugger;
		} else {
			constructTemplate(t, child, templateElem, templateFunc, root, elemName, level, 0);
		}
	}
	if (templateElem.attrs && Object.keys(templateElem.attrs).length > 0) {
		//valueNam/e
		//t.identifier(templateElem.attrs)
		var attrs = t.ObjectExpression(Object.keys(templateElem.attrs).map(function(attrName) {
			var attrVal = templateElem.attrs[attrName];
			var val;
			if(attrVal && attrVal.index !== undefined) {
				val =  "fragment.templateValues[" + attrVal.index + "]";
				return t.ObjectProperty(t.identifier(attrName), t.identifier(val));
			}
			var propVal;

			if (typeof attrVal === 'string') {
				propVal = t.StringLiteral(attrVal);
			} else if (typeof attrVal === 'number') {
				propVal = t.NumericLiteral(attrVal);
			} else if (attrVal === null) {
				propVal = t.identifier('null');
			} else if (attrVal === false) {
				propVal = t.identifier('false');
			} else if (attrVal === true) {
				propVal = t.identifier('true');
			} else if (attrVal.type === 'BinaryExpression') {
				propVal = attrVal;
			} else {
				propVal = t.identifier(attrVal);
			}
			return t.ObjectProperty(t.identifier(attrName), propVal);
		}));

		templateFunc.push(
			t.ExpressionStatement(
				t.callExpression(
					t.memberExpression(t.identifier("template"), t.identifier(addAttributesExpression)),
					[t.identifier(elemName), attrs, t.identifier("fragment")]
				)
			)
		);
	}

	if(parentElemName !== elemName) {
		templateFunc.push(
			t.ExpressionStatement(
				t.callExpression(t.memberExpression(t.identifier(parentElemName), t.identifier(appendChildExpression)), [t.identifier(elemName)])
			)
		);
	}
}

module.exports = function addTemplatesToModule(t, node, templateKey, root) {
	var templateFunc = [];
	constructTemplate(t, root.templateElem, null, templateFunc, root, 'root');
	node.body.push(
		t.FunctionExpression(t.identifier(templateKey), [toReference(t, "fragment"), toReference(t, "template")], t.BlockStatement(templateFunc))
	);
	node.body.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(templateKey + ".key"), t.StringLiteral(templateKey)))
	);
	node.body.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(templateKey + ".type"), t.memberExpression(t.identifier("Inferno"), t.identifier("TemplateTypes.TEMPLATE_API"))))
	);
}