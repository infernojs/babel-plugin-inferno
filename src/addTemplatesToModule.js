var toReference = require('./helpers/to-reference');

var createElementExpression = "Inferno.template.createElement";
var appendChildExpression = ".appendChild";

function constructTemplateValue(t, templateElem, elemName, root, templateFunc, singleChild) {
	var valueName = "fragment.templateValues[" + templateElem.index + "]";
	var elementName = "fragment.templateElements[" + templateElem.index + "]";
	var typeName = "fragment.templateTypes[" + templateElem.index + "]";

	if(singleChild) {
		templateFunc.push(
			t.IfStatement(
				t.binaryExpression("!==", t.identifier("typeof " + valueName), t.literal("object")),
				t.BlockStatement(
					[
						t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elemName + ".textContent"), t.identifier(valueName))),
						t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(typeName), t.identifier("Inferno.FragmentValueTypes.TEXT")))
					]
				),
				t.BlockStatement([
					t.ExpressionStatement(
						t.AssignmentExpression("=", t.identifier(typeName), t.identifier(
							"(" + valueName + ".constructor === Array ? Inferno.FragmentValueTypes.LIST : Inferno.FragmentValueTypes.FRAGMENT)")
						)
					)
				])
			)
		);
	}
	templateFunc.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(elementName), t.identifier(elemName)))
	);
}

function constructTemplate(t, templateElem, parentElem, templateFunc, root, level, index, parentElemName) {
	var elemName;
	if (parentElem === null) {
		elemName = "root";
		//create the root: e.g. var root = Inferno.template.createElement("foo");
		templateFunc.push(t.variableDeclaration("var", [
			t.variableDeclarator(
				t.identifier(elemName),
				t.callExpression(t.identifier(createElementExpression), [t.literal(templateElem.tag)])
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
				t.callExpression(t.identifier(createElementExpression), [t.literal(templateElem.tag)])
			)
		]));
		templateFunc.push(
			t.ExpressionStatement(t.callExpression(t.identifier(parentElemName + appendChildExpression), [t.identifier(elemName)]))
		);
		level++;
	}

	if (templateElem.children) {
		var child;
		if (templateElem.children.length > 1) {
			for (var i = 0; i < templateElem.children.length; i++) {
				constructTemplate(t, templateElem.children[i], templateElem, templateFunc, level, i, elemName);
			}
		} else if ((child = templateElem.children[0]).index !== undefined) {
			constructTemplateValue(t, child, elemName, root, templateFunc, true);
		} else if (typeof child !== "object") {
			debugger;
		} else {
			constructTemplate(t, child, templateElem, templateFunc, root, level, 0, elemName);
		}
	}
}

module.exports = function addTemplatesToModule(t, node, templateKey, root) {
	var templateFunc = [];
	constructTemplate(t, root.templateElem, null, templateFunc, root);
	node.body.push(
		t.functionExpression(t.identifier(templateKey), [toReference(t, "fragment")], t.blockStatement(templateFunc))
	);
	node.body.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(templateKey + ".key"), t.literal(templateKey)))
	);
	node.body.push(
		t.ExpressionStatement(t.AssignmentExpression("=", t.identifier(templateKey + ".type"), t.identifier("Inferno.TemplateTypes.TEMPLATE_API")))
	);
}