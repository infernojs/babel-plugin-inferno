'use strict';

const createTemplateKey = require('./createTemplateKey');
const addTemplateToModule = require('./addTemplateToModule');
const isComponent = require('./helpers/is-component');
const shortnames = require('./shortnames');

const VNodeFlags = {
	Text: 1,
	HtmlElement: 1 << 1,

	ComponentClass: 1 << 2,
	ComponentFunction: 1 << 3,

	HasKeyedChildren: 1 << 4,
	HasNonKeyedChildren: 1 << 5,

	SvgElement: 1 << 6,
	MediaElement: 1 << 7,
	InputElement: 1 << 8,
	TextareaElement: 1 << 9,
	SelectElement: 1 << 10,
	Fragment: 1 << 11,
	Void: 1 << 12,
};

function handleWhiteSpace(str) {
	str = str.replace(/\t/g, '');
	str = str.replace(/(\s*[\r\n]\s*)/g, '');
	return str;
}

function hasHyphenOrColon(attr) {
	return attr.indexOf('-') !== -1 || attr.indexOf(':') !== -1;
}

function getVNodeType(t, type) {
	const astType = type.type;
	let component = false;
	let flags = null;

	if (astType === 'JSXIdentifier') {
		if (isComponent(type.name)) {
			component = true;
		} else {
			const tag = type.name;

			type = t.StringLiteral(tag);
			switch (tag) {
				case 'svg':
					flags = VNodeFlags.SvgElement;
					break;
				case 'input':
					flags = VNodeFlags.InputElement;
					break;
				case 'textarea':
					flags = VNodeFlags.TextareaElement;
					break;
				case 'select':
					flags = VNodeFlags.SelectElement;
					break;
				case 'media':
					flags = VNodeFlags.MediaElement;
					break;
				default:
					flags = VNodeFlags.HtmlElement;
			}
		}
	} else if (astType === 'JSXMemberExpression') {
		component = true;
	}
	return {
		type,
		isComponent: component,
		flags: flags ? t.NumericLiteral(flags) : t.identifier('null')
	};
}

function getVNodeChildren(t, astChildren) {
	let children = [];

	for (let i = 0; i < astChildren.length; i++) {
		const child = astChildren[i];
		const vNode = createVNode(t, child);

		if (vNode != null) {
			children.push(vNode);
		}
	}
	return children.length === 1 ? children[0] : t.arrayExpression(children);
}

function getVNodeProps(t, astProps) {
	let props = null;
	let key = null;
	let ref = null;

	for (let i = 0; i < astProps.length; i++) {
		const astProp = astProps[i];

		if (!props) {
			props = [];
		}
		props.push({
			astName: t.identifier(astProp.name.name),
			astValue: astProp.value
		});
	}
	return {
		props: props == null ? t.identifier('null') : props = t.ObjectExpression(
			props.map(({ astName, astValue }) =>
				t.ObjectProperty(
					astName,
					astValue
				) 
			)
		),
		key: key == null ? t.identifier('null') : key,
		ref: ref == null ? t.identifier('null') : ref
	};
}

function isAstNull(ast) {
	return !ast || ast.name === 'null';
}

function createVNodeArgs(t, flags, type, props, children) {
	const args = [];

	if (!isAstNull(children)) {
		args.unshift(children);
	}
	if (props.length > 0) {
		args.unshift(props);
	} else if (!isAstNull(children)) {
		args.unshift(t.identifier('null'));
	}
	args.unshift(type);
	args.unshift(flags);
	return args;
}

function createVNode(t, astNode) {
	const type = astNode.type;

	switch (type) {
		case 'JSXElement':
			const openingElement = astNode.openingElement;
			const { type, isComponent, flags } = getVNodeType(t, openingElement.name);
			let { props, key, ref } = getVNodeProps(t, openingElement.attributes);
			let children = getVNodeChildren(t, astNode.children); 
			
			if (isComponent) {
				if (props.properties) {
					props.properties.push(
						t.ObjectProperty(
							t.identifier('children'),
							children
						)
					);
				} else {
					props = t.ObjectExpression([
						t.ObjectProperty(
							t.identifier('children'),
							children
						)
					]);
				}
				children = t.identifier('null');
			}
			
			return t.callExpression(
				t.memberExpression(t.identifier('Inferno'), t.identifier('createVNode')),
				createVNodeArgs(
					t,
					flags,
					type,
					props,
					children
				)
			);
		case 'JSXText':
			const text = handleWhiteSpace(astNode.value);

			if (text !== '') {
				return t.StringLiteral(text);
			}
			break;
		default:
			debugger;
	}
}

module.exports = function (options) {
	const t = options.types;

	return {
		visitor: {
			JSXElement: {
				enter(path, state) {
					const opts = state.opts;
					const node = createVNode(t, path.node);
					
					path.replaceWith(node);
				}
			}
		},
		inherits: require('babel-plugin-syntax-jsx')
	};
};

