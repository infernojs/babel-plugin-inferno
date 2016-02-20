"use strict";

var toReference = require('./helpers/to-reference');
var isArray = require('./helpers/is-array');
var constructTemplateNode = require('./constructTemplateNode');

module.exports = function addTemplatesToModule(t, toInsert, templateKey, root) {
	var node = toInsert.node;
	var index = toInsert.index;

	node.body.splice(index, 0,
		t.variableDeclaration("var", [
			t.variableDeclarator(t.identifier(templateKey),
			t.callExpression(t.memberExpression(t.identifier("Inferno"), t.identifier("createTemplate")), [
				t.FunctionExpression(null, root.templateValues.map(function(val, i) { return toReference(t, "v" + i) }), t.BlockStatement([
					t.ReturnStatement(constructTemplateNode(t, root.templateElem, true))
				]))
			]))
		])
	);
}