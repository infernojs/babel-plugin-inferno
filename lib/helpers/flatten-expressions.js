var toStatement = require('./to-statement');
var toExpression = require('./to-expression');

// Helper to flatten out sequence expressions into a top level
// expression statements.
module.exports = function flattenExpressions(t, expressions, nodes) {
	nodes = nodes == null ? [] : nodes;
	return expressions.reduce((nodes, node) => {
		if (t.isSequenceExpression(node)) {
			return flattenExpressions(t, node.expressions, nodes);
		}

		nodes.push(toExpression(t, node));
		return nodes;
	}, nodes);
}
