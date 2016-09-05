'use strict';

const createTemplateKey = require('./createTemplateKey');
const addTemplateToModule = require('./addTemplateToModule');
const isComponent = require('./helpers/is-component');

function handleWhiteSpace(str) {
	str = str.replace(/\t/g, '');
	str = str.replace(/(\s*[\r\n]\s*)/g, '');
	return str;
}

function getHoistedNode(lastNode, path) {
	if (path.parentPath === null) {
		const body = path.node.body;
		const index = body.indexOf(lastNode);
		return {
			node: path.node,
			index: index
		};
	} else {
		return getHoistedNode(path.node, path.parentPath);
	}
}

function hasHyphenOrColon(attr) {
	return attr.indexOf('-') !== -1 || attr.indexOf(':') !== -1;
}

function applyKeyToNode(t, node, key) {
	return t.callExpression(
		t.memberExpression(node, t.identifier('key')), (
			[key]
		)
	);
}

function applyRefToNode(t, node, ref) {
	return t.callExpression(
		t.memberExpression(node, t.identifier('ref')), (
			[ref]
		)
	);
}

function createHooksObject(t, hooks) {
	if (hooks) {
		if (Array.isArray(hooks)) {
			if (hooks.length > 0) {
				return t.ObjectExpression(hooks.map(
					({ name, value, spread }) => spread ? t.SpreadProperty(name) : t.ObjectProperty(name, value)
				));
			}
		} else {
			return hooks;
		}
	}
	return t.identifier('null');
}

function createPropsObject(t, props) {
	if (props.length === 1 && props[0].spread) {
		return props[0].name;
	} else {
		return t.ObjectExpression(props.map(
			({ prop, value, spread }) => spread ? t.SpreadProperty(prop) : t.ObjectProperty(prop, value)
		));
	}
}

function pushDescriptors(t, bpDescriptors, d1, d2) {
	if (bpDescriptors.length > 7) {
		bpDescriptors[6].elements.push(d1);
		bpDescriptors[7].elements.push(d2);
	} else if (bpDescriptors.length > 5) {
		bpDescriptors.push(
			t.arrayExpression([d1]),
			t.arrayExpression([d2])
		);
	} else {
		bpDescriptors.push(
			d1,
			d2
		);
	}
}

function pushBpValue(t, bpValues, v) {
	if (bpValues.length > 3) {
		bpValues[3].value.elements.push(v);
	} else if (bpValues.length > 2) {
		bpValues.push(
			t.ObjectProperty(t.identifier('v3'), t.arrayExpression([v]))
		);
	} else {
		bpValues.push(
			t.ObjectProperty(t.identifier('v' + bpValues.length), v)
		);
	}
}

function createVElement(t, bps, tag, key, ref, staticProps, dynamicProps, dynamicChildren, staticChildren, childrenType, templateState) {
	let { hashMap, hash, bpCounter } = templateState;
	const bpValues = [];
	let children;

	if (dynamicChildren && dynamicChildren.length > 0) {
		if (dynamicChildren.length === 1) {
			children = dynamicChildren[0];
		} else if (dynamicChildren.length > 1) {
			children = t.arrayExpression(dynamicChildren);
		}
		if (childrenType === null) {
			if (children.type !== 'Identifier' && dynamicChildren.length === 1 && !isStaticLiteralType(children) || !children.name === 'undefined') {
				childrenType = t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ChildrenTypes')), t.identifier('NODE'));
			} else {
				childrenType = t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ChildrenTypes')), t.identifier('UNKNOWN'));
			}
		}
		pushBpValue(
			t,
			bpValues,
			children
		);
		hash += `|static:${ dynamicChildren.length }|type:${ expressionToString(childrenType) }`;
	} else {
		hash += `|static:${ staticChildren.length }|type:${ childrenType ? expressionToString(childrenType) : 'null' }`;
	}
	const bpKeyFromMap = hashMap.get(hash);
	const bpKey = bpKeyFromMap || 'bp' + bpCounter.index;

	if (!bpKeyFromMap) {
		const bpDescriptors = [];

		if (dynamicChildren && dynamicChildren.length > 0) {
			pushDescriptors(
				t,
				bpDescriptors,
				t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('CHILDREN')),
				childrenType
			);
		}
		for (let i = 0; i < dynamicProps.length; i++) {
			const dynamicProp = dynamicProps[i];
			const { name, prop } = dynamicProp;

			pushBpValue(
				t,
				bpValues,
				dynamicProp.value
			);
			if (name === 'className') {
				pushDescriptors(
					t,
					bpDescriptors,
					t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP_CLASS_NAME')),
					t.identifier('null')
				);
			} else if (name === 'ref') {
				pushDescriptors(
					t,
					bpDescriptors,
					t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP_REF')),
					t.identifier('null')
				);
			} else if (name === 'style') {
				pushDescriptors(
					t,
					bpDescriptors,
					t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP_STYLE')),
					t.identifier('null')
				);
			} else if (name.substr(0,5) === 'data-') {
				pushDescriptors(
					t,
					bpDescriptors,
					t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP_DATA')),
					t.StringLiteral(name.substring(5))
				);
			} else {
				pushDescriptors(
					t,
					bpDescriptors,
					t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP')),
					t.StringLiteral(name)
				);
			}
		}
		for (let i = bpValues.length; i < 4; i++) {
			bpDescriptors.push(
				t.identifier('null'),
				t.identifier('null')
			);
		}
		children = t.identifier('null');

		if (staticChildren.length > 0) {
			children = staticChildren.length === 1 ? staticChildren : t.arrayExpression(staticChildren);
		}
		bps.push({
			content: [
				t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createStaticVElement')), [
					t.StringLiteral(tag),
					staticProps && staticProps.length > 0 ? createPropsObject(t, staticProps) : t.identifier('null')
				].concat(children))
			].concat(bpDescriptors),
			index: bpCounter.index
		});
		hashMap.set(hash, bpKey);
		bpCounter.index++;
	} else {
		for (let i = 0; i < dynamicProps.length; i++) {
			const dynamicProp = dynamicProps[i];
			const { name, prop } = dynamicProp;

			pushBpValue(
				t,
				bpValues,
				dynamicProp.value
			);
		}
	}
	for (let i = bpValues.length; i < 4; i++) {
		bpValues.push(
			t.ObjectProperty(t.identifier('v' + i), t.identifier('null'))
		);
	}
	return t.ObjectExpression([
		t.ObjectProperty(t.identifier('bp'), t.identifier(bpKey)),
		t.ObjectProperty(t.identifier('dom'), t.identifier('null')),
		t.ObjectProperty(t.identifier('key'), key || t.identifier('null')),
		t.ObjectProperty(t.identifier('type'), t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('NodeTypes')), t.identifier('OPT_ELEMENT')))
	].concat(bpValues));
}

function createVComponent(t, component, key, ref, props, hooks) {
	const args = [
		component
	];

	if (props && props.length > 0) {
		args.push(createPropsObject(t, props));
	} else {
		args.push(t.identifier('null'));
	}
	if (key) {
		args.push(key);
	} else {
		args.push(t.identifier('null'));
	}
	args.push(createHooksObject(t, hooks));
	if (ref) {
		args.push(ref);
	} else {
		args.push(t.identifier('null'));
	}
	return t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createVComponent')), args);
}

function createChildren(t, nodeChildren, bps, templateState) {
	const staticChildren = [];
	const dynamicChildren = [];
	let isDynamic = false;

	for (let i = 0; i < nodeChildren.length; i++) {
		const { node, isStatic } = createNode(t, nodeChildren[i], bps, templateState);

		if (node) {
			if (isStatic && !isDynamic) {
				staticChildren.push(node);
			} else {
				if (!isDynamic) {
					isDynamic = true;
					dynamicChildren.concat(staticChildren);
					staticChildren.length = 0;
				}
				dynamicChildren.push(node);
			}
		}
	}
	return { staticChildren, dynamicChildren };
}

function isStaticLiteralType(type) {
	switch (type) {
		case 'NullLiteral':
		case 'NumericLiteral':
		case 'StringLiteral':
		case 'BooleanLiteral':
			return true;
		default:
			return false;
	}
}

function createTemplateProps(t, attributes, templateState, component) {
	let staticProps = [];
	let dynamicProps = [];
	let hooks = null;
	let key = null;
	let childrenType = null;
	let ref = null;
	// need to optimise this really
	const hasSpreadProps = attributes.some(({ type }) => type === 'JSXSpreadAttribute');

	attributes.forEach(attribute => {
		let staticProp;
		switch (attribute.type) {
			case 'JSXSpreadAttribute':
				const spread = attribute.argument;

				props.push({ name: spread, value: null, spread: true });
				break;
			case 'JSXAttribute':
				let name = attribute.name;
				const type = name.type;

				if (type === 'JSXIdentifier') {
					name = name.name;
				} else if (type === 'JSXNamespacedName') {
					name = name.namespace.name + ':' + name.name.name;
				} else {
					debugger;
				}
				let value = attribute.value;

				if (value) {
					if (value.type === 'JSXExpressionContainer') {
						const expression = value.expression;

						value = expression;
						if (isStaticLiteralType(expression.type) || expression.name === 'undefined') {
							templateState.hash += `|prop:${ name }=${ expression.value }`;
							staticProp = true;
						}
					} else if (value.type === 'StringLiteral') {
						value = t.StringLiteral(value.value);
						templateState.hash += `|prop:${ name }='${ value.value }'`;
						staticProp = true;
					} else {
						debugger;
					}
				} else {
					staticProp = true;
					value = t.booleanLiteral(true);
					templateState.hash += `|prop:${ name }=true`;
				}
				if (name === 'key') {
					key = value;
				} else if (name === 'ref') {
					ref = value;
				} else if (name === 'childrenType' && !component) {
					childrenType = value;
					templateState.hash += `|prop:childrenType=${ expressionToString(value) }`;
				} else if (name === 'hooks' && component) {
					if (hooks) {
						throw new Error('Dynamic hooks cannot be mixed with static hooks');
					}
					hooks = value;
				} else if (name.substr(0, 11) === 'onComponent' && component) {
					if (!hooks) {
						hooks = [];
					} else if (!Array.isArray(hooks)) {
						throw new Error('Dynamic hooks cannot be mixed with static hooks');
					}
					name = t.identifier(name);
					hooks.push({ name, value, spread: false });
				} else {
					const prop = hasHyphenOrColon(name) ? t.StringLiteral(name) : t.identifier(name);
					if (staticProp) {
						staticProps.push({ name, prop, value, spread: false });
					} else {
						dynamicProps.push({ name, prop, value, spread: false });
					}
				}
				break;
			default:
				debugger;
		}
	});
	// if (!component && hasSpreadProps) {
	// 	const param = 'spreadProp' + templateState.props++;

	// 	args.push(createPropsObject(t, props));
	// 	props = [{ name: t.identifier(param), value: null, spread: true }];
	// 	params.push(param);
	// 	templateState.hash += `|props='${ param }'`;
	// }
	return { staticProps, dynamicProps, hooks, key, ref, childrenType };
}

function expressionToString(exp, str) {
	if (exp.object && exp.property) {
		return expressionToString(exp.object) + '.' + expressionToString(exp.property);
	} else if (exp.property) {
		return exp.property.name;
	} else if (exp.name) {
		return exp.name;
	} else if (exp.value) {
		return exp.value;
	}
}

function createNode(t, node, bps, templateState) {
	switch (node.type) {
		case 'JSXElement':
			const openingElement = node.openingElement;
			const attributes = openingElement.attributes;
			let name = openingElement.name;
			let component = false;
			const type = name.type;

			if (type === 'JSXIdentifier') {
				if (isComponent(name.name)) {
					component = true;
					templateState.hash += `|component:${ name.name }`;
				} else {
					name = name.name;
					templateState.hash += `|element:'${ name }'`;
				}
			} else if (type === 'JSXMemberExpression') {
				templateState.hash += `|component:${ expressionToString(name) }`;
				component = true;
			}
			const { staticProps, dynamicProps, key, ref, hooks, childrenType } = createTemplateProps(t, attributes, templateState, component);

			if (component) {
				const { dynamicChildren, staticChildren } = createChildren(t, node.children, bps, templateState);

				if (dynamicChildren && dynamicChildren.length > 0) {
					dynamicProps.push({
						mame: 'children',
						prop: t.identifier('children'),
						value: dynamicChildren.length > 1 ? t.arrayExpression(dynamicChildren) : dynamicChildren[0]
					});
				}
				return { isStatic: false, node: createVComponent(t, name, key, ref, dynamicProps, hooks) };
			} else {
				const hasChildren = node.children.length > 0;

				templateState.hash += hasChildren ? '|children' : '';
				const { dynamicChildren, staticChildren } = createChildren(t, node.children, bps, templateState);

				return { isStatic: false, node: createVElement(t, bps, name, key, ref, staticProps, dynamicProps, dynamicChildren, staticChildren, childrenType, templateState) };
			}
		case 'JSXText':
			const text = handleWhiteSpace(node.value);

			if (text !== '') {
				templateState.hash += `|text:'${ text }'`;
				return { isStatic: true, node: t.StringLiteral(text) };
			}
			return { node: null, isStatic: true };
		case 'JSXExpressionContainer':
			const expression = node.expression;
			let isStatic = false;

			templateState.hash += `|'${ expressionToString(expression) }'`;
			if (isStaticLiteralType(expression.type) || expression.name === 'undefined') {
				isStatic = true;
			}
			return { node: expression, isStatic };
		default:
			return { node: null, isStatic: true };
	}
}

module.exports = function (options) {
	const t = options.types;

	return {
		visitor: {
			JSXElement: {
				enter(path, scope) {
					const opts = scope.opts;

					if (!opts.hashMap) {
						opts.hashMap = new Map();
						opts.bps = [];
						opts.bpCounter = {
							index: 0
						};
					}
					const templateState = {
						key: 0,
						props: 0,
						children: 0,
						component: 0,
						ref: 0,
						hooks: 0,
						hash: 'tpl',
						hashMap: opts.hashMap,
						bpCounter: opts.bpCounter
					};
					const bps = opts.bps;
					const bpCounter = opts.bpCounter;
					const { node } = createNode(t, path.node, bps, templateState);
					const hash = templateState.hash;
					// const hashMapId = opts.hashMap.get(hash);
					// const id = hashMapId === undefined ? opts.counter.id : hashMapId;

					path.replaceWith(node);
					if (bps.length > 0) {
						addTemplateToModule(t, getHoistedNode(path.node, path.parentPath), bps, opts.pragma, opts.pragmaMethod);
						opts.bps = [];
					}
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

