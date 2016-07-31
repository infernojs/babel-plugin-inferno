const toReference = require('./helpers/to-reference');

module.exports = function addTemplateToModule(t, toInsert, template, id, params, pragma, pragmaMethod) {
	const node = toInsert.node;
	const index = toInsert.index;
	const paramIdentifiers = params.map(param => t.identifier(param));

	node.body.splice(index, 0,
		t.VariableDeclaration('var', [
			t.VariableDeclarator(t.Identifier('tpl' + id),
				t.callExpression(t.memberExpression(t.identifier(pragma || 'Inferno'), t.identifier(pragmaMethod || 'createVTemplate')), [
					t.functionExpression(null, paramIdentifiers, t.blockStatement([
						t.returnStatement(template)
					])),
					// ideally we make this customisable with pragma or something
					// the user should be able to customise their template render
					t.identifier('InfernoDOM')
				])
			)
		])
	);
};
