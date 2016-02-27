'use strict';

const isArray = require('./helpers/is-array');
const isNullOrUndefined = require('./helpers/is-null-or-undefined');

function insertVariable(t, index) {
	return t.ObjectProperty(t.identifier('tag'), t.ObjectExpression(
		[t.ObjectProperty(t.identifier('index'), t.NumericLiteral(index))]
	));
}

function constructTemplateChildren(t, children) {
	if (isArray(children)) {
		if (children.length > 1) {
			return t.ArrayExpression(
				children.map(function (child) {
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
	let objectValue = t.NullLiteral;

	if (isNullOrUndefined(val)) {
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

function isAttrAnEvent(attr) {
	return attr[0] === 'o' && attr[1] === 'n' && attr.length > 3;
}

function isAttrAComponentEvent(attr) {
	return attr.substring(0, 11) === 'onComponent' && attr.length > 12;
}

function constructTemplateNode(t, node, isRoot) {
	if (isNullOrUndefined(node)) {
		return null;
	}
	if (node.index !== undefined) {
		return t.identifier('v' + node.index);
	}

	const tag = node.tag;
	const instance = node.instance;

	if (tag) {
		const template = [];

		template.push(t.ObjectProperty(t.identifier('tag'), tag));
		const attrs = node.attrs;

		if (!isNullOrUndefined(attrs)) {
			if (attrs.index !== undefined) {
				template.push(t.ObjectProperty(t.identifier('attrs'), t.identifier('v' + attrs.index)));
			} else {
				if (attrs.key) {
					template.push(t.ObjectProperty(t.identifier('key'), getObjectValue(t, attrs.key)));
					delete attrs.key;
				}
				if (attrs.className !== undefined && tag.type === 'StringLiteral') {
					template.push(t.ObjectProperty(t.identifier('className'), getObjectValue(t, attrs.className)));
					delete attrs.className;
				}
				if (attrs.style !== undefined && tag.type === 'StringLiteral') {
					template.push(t.ObjectProperty(t.identifier('style'), getObjectValue(t, attrs.style)));
					delete attrs.style;
				}
				const events = {};

				for (let attr in attrs) {
					if ((isAttrAnEvent(attr) && tag.type === 'StringLiteral')) {
						events[attr.substring(2).toLowerCase()] = attrs[attr];
						delete attrs[attr];
					} else if (tag.type !== 'StringLiteral' && isAttrAComponentEvent(attr)) {
						events['c' + attr.substring(3)] = attrs[attr];
						delete attrs[attr];
					}
				}
				const attrKeys = Object.keys(attrs);

				if (attrKeys.length > 0) {
					template.push(t.ObjectProperty(t.identifier('attrs'), t.ObjectExpression(attrKeys.map(function (attrKey) {
						return t.ObjectProperty(t.identifier(attrKey), getObjectValue(t, attrs[attrKey]));
					}))));
				}

				const eventsKeys = Object.keys(events);

				if (eventsKeys.length > 0) {
					template.push(t.ObjectProperty(t.identifier('events'), t.ObjectExpression(eventsKeys.map(function (eventKey) {
						return t.ObjectProperty(t.identifier(eventKey), getObjectValue(t, events[eventKey]));
					}))));
				}
			}
		}
		const children = node.children;

		if (!isNullOrUndefined(children)) {
			const childrenItems = constructTemplateChildren(t, children);

			if (childrenItems !== null) {
				template.push(t.ObjectProperty(t.identifier('children'), childrenItems));
			}
		}

		if (instance === null) {
			template.push(t.ObjectProperty(t.identifier('instance'), t.identifier('null')));
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

module.exports = constructTemplateNode;
