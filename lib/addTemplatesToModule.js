const toReference = require('./helpers/to-reference');
const constructTemplates = require('./constructTemplates');

module.exports = function addTemplatesToModule(t, toInsert, templates) {
	const node = toInsert.node;
	const index = toInsert.index;

	Object.keys(templates).forEach(function(id) {
		node.body.splice(index, 0,
			t.VariableDeclaration('var', [
				t.VariableDeclarator(t.Identifier('bp' + id),
					t.callExpression(t.memberExpression(t.identifier("Inferno"), t.identifier("createBlueprint")), [
						templates[id]
					])
				)
			])
		);
	});

};
