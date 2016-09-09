const toReference = require('./helpers/to-reference');

module.exports = function addTemplateToModule(t, toInsert, bps, pragma, pragmaMethod) {
	const node = toInsert.node;
	const index = toInsert.index;
	// const paramIdentifiers = params.map(param => t.identifier(param));

	node.body.splice(index, 0,
		t.VariableDeclaration('var', bps.map(({ index, content }) =>
			t.VariableDeclarator(t.Identifier('bp' + index),
				t.callExpression(t.memberExpression(t.identifier(pragma || 'Inferno'), t.identifier('createOptBlueprint')), content)
			)
		))
	);
};
