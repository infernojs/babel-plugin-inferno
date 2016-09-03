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

function createVElement(t, bps, tag, key, ref, staticProps, dynamicProps, dynamicChildren, staticChildren, childrenType) {
	const bpValues = [];
	const bpDescriptors = [];

	for (let i = 0; i < dynamicProps.length; i++) {
		const dynamicProp = dynamicProps[i];
		const { name, prop } = dynamicProp;

		bpValues.push(
			t.ObjectProperty(t.identifier('v' + i), dynamicProp.value)
		);
		if (name === 'className') {
			bpDescriptors.push(
				t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP_CLASS_NAME')),
				t.identifier('null')
			);
		} else if (name === 'style') {
			bpDescriptors.push(
				t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP_STYLE')),
				t.identifier('null')
			);
		} else if (name.substr(0,5) === 'data-') {
			bpDescriptors.push(
				t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP_DATA')),
				t.StringLiteral(name.substring(5))
			);
		} else {
			bpDescriptors.push(
				t.memberExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('ValueTypes')), t.identifier('PROP')),
				prop
			);
		}
	}
	bps.push([
		t.callExpression(t.memberExpression(t.identifier('Inferno'), t.identifier('createStaticVElement')), [
			t.StringLiteral(tag),
			staticProps && staticProps.length > 0 ? createPropsObject(t, staticProps) : t.identifier('null')
		])
	].concat(bpDescriptors));
	return t.ObjectExpression([
		t.ObjectProperty(t.identifier('bp'), t.identifier('bp' + (bps.length - 1))),
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
	const children = [];

	for (let i = 0; i < nodeChildren.length; i++) {
		const { node } = createNode(t, nodeChildren[i], bps, templateState);

		debugger;

		if (node) {
			children.push(node);
		}
	}
	if (children.length === 1) {
		return children;
	} else {
		return children;
	}
}

function isStaticLiteralType(type) {
	switch (type) {
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
						if (isStaticLiteralType(expression.type)) {
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
					props.push({
						name: t.identifier('children'),
						value: dynamicChildren.length > 1 ? t.arrayExpression(dynamicChildren) : dynamicChildren[0]
					});
				}
				return { skipTemplate: true, node: createVComponent(t, name, key, ref, dynamicProps, hooks) };
			} else {
				const hasChildren = node.children.length > 0;

				templateState.hash += hasChildren ? '|[children' : '';
				const { dynamicChildren, staticChildren } = createChildren(t, node.children, bps, templateState);

				templateState.hash += hasChildren ? ']' : '';
				return { skipTemplate: false, node: createVElement(t, bps, name, key, ref, staticProps, dynamicProps, dynamicChildren, staticChildren, childrenType) };
			}
		case 'JSXText':
			const text = handleWhiteSpace(node.value);

			if (text !== '') {
				templateState.hash += `|text:'${ text }'`;
				return { skipTemplate: false, node: t.StringLiteral(text) };
			}
			return { skipTemplate: false, node: null };
		case 'JSXExpressionContainer':
			templateState.hash += `|'${ expressionToString(node.expression) }'`;
			return { skipTemplate: false, node: expression };
		default:
			return { skipTemplate: false, node: null };
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
					}
					const templateState = {
						key: 0,
						props: 0,
						children: 0,
						component: 0,
						ref: 0,
						hooks: 0,
						hash: 'tpl'
					};
					const bps = [];
					const { skipTemplate, node } = createNode(t, path.node, bps, templateState);
					const hash = templateState.hash;
					// const hashMapId = opts.hashMap.get(hash);
					// const id = hashMapId === undefined ? opts.counter.id : hashMapId;

					if (skipTemplate) {
						path.replaceWith(node);
					} else {
						path.replaceWith(node);
						// if (hashMapId === undefined) {
						// 	opts.hashMap.set(hash, id);
						addTemplateToModule(t, getHoistedNode(path.node, path.parentPath), bps, opts.pragma, opts.pragmaMethod);
						// }
					}
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

