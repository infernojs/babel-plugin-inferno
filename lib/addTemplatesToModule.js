"use strict";

var toReference = require('./helpers/to-reference');
var isArray = require('./helpers/is-array');

function insertVariable(t, index) {
	return t.ObjectProperty(t.identifier('tag'), t.ObjectExpression(
		[t.ObjectProperty(t.identifier('index'), t.NumericLiteral(index))]
	));
}

function constructTemplateChildren(t, children) {
	if (isArray(children)) {
		if (children.length > 1) {
			return t.ArrayExpression(
				children.map(function(child) {
					return constructTemplateNode(t, child);
				})
			);
		} else {
			return constructTemplateNode(t, children[0]);
		}
	} else {
		return constructTemplateNode(children);
	}
}

function getObjectValue(t, val) {
	var objectValue = t.NullLiteral;

	if (val == null) {
		objectValue = t.identifier('null');
	} else if (val.index !== undefined) {
		objectValue = t.identifier('v' + val.index);
	} else if (typeof val === 'string') {
		objectValue = t.StringLiteral(val);
	} else if (typeof val === 'number') {
		objectValue = t.NumericLiteral(val);
	} else if (typeof val === 'boolean') {
		objectValue = t.BooleanLiteral(val);
	} else {
		objectValue = val;
	}

	return objectValue;
}

function constructTemplateNode(t, node, isRoot) {
	if (node == null) {
		return null;
	}
	if (node.index !== undefined) {
		return t.identifier('v' + node.index);
	}

	var tag = node.tag;

	if (tag) {
		var template = [];

		if (tag.index !== undefined) {
			template.push(t.ObjectProperty(t.identifier('tag'), t.identifier('v' + tag.index)))
		} else {
			template.push(t.ObjectProperty(t.identifier('tag'), t.StringLiteral(tag)))
		}
		var attrs = node.attrs;

		if (attrs != null) {
			if (attrs.index !== undefined) {
				template.push(t.ObjectProperty(t.identifier('attrs'), t.identifier('v' + attrs.index)));
			} else  {
				var attrKeys = Object.keys(attrs);

				if (attrs.key && isRoot) {
					template.push(t.ObjectProperty(t.identifier('key'), getObjectValue(t, attrs.key)))
					delete attrs.key;
				}
				if (attrKeys.length > 0) {
					template.push(t.ObjectProperty(t.identifier('attrs'), t.ObjectExpression(attrKeys.map(function (attrKey) {
						var id = /[\W]+/.test(attrKey) ? "'" + attrKey + "'" : attrKey;
						return t.ObjectProperty(t.identifier(id), getObjectValue(t, attrs[attrKey]));
					}))));
				}
			}
		}
		var children = node.children;

		if (children != null) {
			var childrenItems = constructTemplateChildren(t, children);

			if (childrenItems !== null) {
				template.push(t.ObjectProperty(t.identifier('children'), childrenItems));
			}
		}

		return t.ObjectExpression(template);
	} else {
		if (typeof node === 'string') {
			return t.StringLiteral(node);
		} else if (typeof node === 'number') {
			return t.NumericLiteral(node);
		} else if (typeof node === 'boolean') {
			return t.BooleanLiteral(node);
		} else {
			return node;
		}
	}
}

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
