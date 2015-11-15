var toReference = require('./helpers/to-reference');

var createElementExpression = "template.createElement";
var createTextNodeExpression = "template.createTextNode";
var createEmptyTextNodeExpression = "template.createEmptyTextNode()";
var addAttributesExpression = "template.addAttributes";
var addPropsExpression = "template.addProps";
var appendChildExpression = ".appendChild";

//t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.TEXT_DIRECT"))

function constructTemplateValue(t, templateElem, elemName, root, templateFunc, singleChild, level, index) {
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
	} else {
		var elemName = "child_" + level + "_" + index;
		templateFunc.push(
			t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(elemName)
				)
			])
		);
		templateFunc.push(
			t.IfStatement(
				t.binaryExpression("!==", t.identifier("typeof " + valueName), t.StringLiteral("object")),
				t.BlockStatement([
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elemName), t.memberExpression(t.identifier("Inferno"), t.identifier(createTextNodeExpression + `(${ valueName })`)))),
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName), t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.TEXT_DIRECT"))))
				]),
				t.BlockStatement([
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elemName), t.memberExpression(t.identifier("Inferno"), t.identifier(createEmptyTextNodeExpression)))),
					t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName), t.identifier(
							"(" + valueName + ".constructor === Array ? Inferno.FragmentValueTypes.LIST_REPLACE : Inferno.FragmentValueTypes.FRAGMENT_REPLACE)")
					))
				])
			)
		);
	}
	templateFunc.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(elemName)))
	);
}

function constructTemplateComponentValue(t, templateElem, elemName, templateFunc, root) {
	templateFunc.push(t.variableDeclaration("var", [
		t.variableDeclarator(
			t.identifier(elemName),
			t.memberExpression(t.identifier("Inferno"), t.identifier(createEmptyTextNodeExpression))
		)
	]));
	var typeName;
	var elementName;
	if(root.templateValues.length > 1) {
		typeName = "fragment.templateTypes[" + templateElem.component.index + "]";
		elementName = "fragment.templateElements[" + templateElem.component.index + "]";
	} else {
		typeName = "fragment.templateType";
		elementName = "fragment.templateElement";
	}

	templateFunc.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName),
			t.memberExpression(t.identifier("Inferno"), t.identifier("FragmentValueTypes.COMPONENT"))
		))
	);
	templateFunc.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(elemName)))
	);
}

function constructTemplate(t, templateElem, parentElem, templateFunc, root, level, index, parentElemName) {
	var elemName;
	if (parentElem === null) {
		elemName = "root";
		//create the root: e.g. var root = Inferno.template.createElement("foo");
		if(templateElem.component) {
			//debugger;
		} else {
			templateFunc.push(t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(elemName),
					t.callExpression(t.memberExpression(t.identifier("Inferno"), t.identifier(createElementExpression)), [t.StringLiteral(templateElem.tag)])
				)
			]));
		}
		//assign the root to the fragment.dom
		templateFunc.push(t.ExpressionStatement(t.AssignmentExpression("=", t.identifier("fragment.dom"), t.identifier("root"))));
		level = 0;
	} else {
		elemName = "child_" + level + "_" + index;
		if(templateElem.component) {
			constructTemplateComponentValue(t, templateElem, elemName, templateFunc, root);
		} else {
			templateFunc.push(t.variableDeclaration("var", [
				t.variableDeclarator(
					t.identifier(elemName),
					t.callExpression(t.memberExpression(t.identifier("Inferno"), t.identifier(createElementExpression)), [t.StringLiteral(templateElem.tag)])
				)
			]));
		}
		templateFunc.push(
			t.ExpressionStatement(
				t.callExpression(t.identifier(parentElemName + appendChildExpression), [t.identifier(elemName)])
			)
		);
		level++;
	}

	if (templateElem.children) {
		var child;
		if (templateElem.children.length > 1) {
			for (var i = 0; i < templateElem.children.length; i++) {
				var child = templateElem.children[i];
				if(typeof child === "string") {
					templateFunc.push(
						t.ExpressionStatement(
							t.callExpression(
								t.identifier(elemName + appendChildExpression),
								[t.memberExpression(t.identifier("Inferno"), t.identifier(createTextNodeExpression + `("${ child }")`))]
							)
						)
					);
				} else if (child.index !== undefined) {
					constructTemplateValue(t, child, elemName, root, templateFunc, false, level, i);
				} else {
					constructTemplate(t, templateElem.children[i], templateElem, templateFunc, level, i, elemName);
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
			constructTemplateValue(t, child, elemName, root, templateFunc, true);
		} else if (typeof child !== "object") {
			debugger;
		} else {
			constructTemplate(t, child, templateElem, templateFunc, root, level, 0, elemName);
		}
	}

	if (templateElem.attrs) {
		//valueNam/e
		//t.identifier(templateElem.attrs)
		var attrs = t.ObjectExpression(Object.keys(templateElem.attrs).map(function(attrName) {
			var attrVal = templateElem.attrs[attrName];
			var val;
			if(attrVal.index !== undefined) {
				val =  "fragment.templateValues[" + attrVal.index + "]";
				return t.ObjectProperty(t.identifier(attrName), t.identifier(val));
			}
			return t.ObjectProperty(t.identifier(attrName), t.StringLiteral(attrVal));
		}));

		templateFunc.push(
			t.ExpressionStatement(
				t.callExpression(
					t.identifier(templateElem.component ? addPropsExpression : addAttributesExpression),
					[t.identifier(elemName), attrs, t.identifier("fragment")]
				)
			)
		);
	}
}

module.exports = function addTemplatesToModule(t, node, templateKey, root) {
	var templateFunc = [];
	constructTemplate(t, root.templateElem, null, templateFunc, root);
	node.body.push(
		t.FunctionExpression(t.identifier(templateKey), [toReference(t, "fragment")], t.BlockStatement(templateFunc))
	);
	node.body.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(templateKey + ".key"), t.StringLiteral(templateKey)))
	);
	node.body.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(templateKey + ".type"), t.memberExpression(t.identifier("Inferno"), t.identifier("TemplateTypes.TEMPLATE_API"))))
	);
}