'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
let container;
		function StatelessComponent() {
			return (
				<div>
					Hello world
				</div>
			)
		}

		afterEach(() => {
			render(null, container);
		});

		beforeEach(() => {
			container = document.createElement('div');
		});

		it('"onComponentWillMount" hook should fire', () => {
			const spyObj = {fn: () => {}};
			const spy = sinon.spy(spyObj, 'fn');
			render(<StatelessComponent onComponentWillMount={spyObj.fn} />, container);

			expect(spy.callCount).to.equal(1);
		});

		it('"onComponentDidMount" hook should fire, args DOM', () => {
			const spyObj = {fn: () => {}};
			const spy = sinon.spy(spyObj, 'fn');
			render(<StatelessComponent onComponentDidMount={spyObj.fn} />, container);

			expect(spy.callCount).to.equal(1);
			expect(spy.getCall(0).args[0]).to.equal(container.firstChild);
		});

		it('"onComponentWillUnmount" hook should fire', () => {
			const spyObj = {fn: () => {}};
			const spy = sinon.spy(spyObj, 'fn');
			render(<StatelessComponent onComponentWillUnmount={spyObj.fn} />, container);
			expect(spy.callCount).to.equal(0);
			// do unmount
			render(null, container);

			expect(spy.callCount).to.equal(1);
		});

		it('"onComponentWillUpdate" hook should fire', () => {
			const spyObj = {fn: () => {}};
			const spy = sinon.spy(spyObj, 'fn');
			render(<StatelessComponent onComponentWillUpdate={spyObj.fn} />, container);
			expect(spy.callCount).to.equal(0);

			// console.log(spy.getCall(0).args);
			// TODO: How can we verify last props in unit test
			// expect(spy.getCall(0).args[0]).to.equal(node.props, 'verify last props'); // last props
			// expect(spy.getCall(0).args[1]).to.equal(node.props, 'verify next props'); // next props
		});

		it('"onComponentDidUpdate" hook should fire', () => {
			const spyObj = {fn: () => {}};
			const spy = sinon.spy(spyObj, 'fn');
			render(<StatelessComponent onComponentDidUpdate={spyObj.fn} />, container);
			expect(spy.callCount).to.equal(0); // Update 1
			render(<StatelessComponent onComponentDidUpdate={spyObj.fn} />, container);
			expect(spy.callCount).to.equal(1); // Update 2
		});

		it('"onComponentShouldUpdate" hook should fire, should call render when return true', () => {
			let onComponentShouldUpdateCount = 0;
			let renderCount = 0;
			const StatelessComponent = () => { renderCount++; return null; };

			render(<StatelessComponent onComponentShouldUpdate={() => { onComponentShouldUpdateCount++; return true; }} />, container);
			expect(onComponentShouldUpdateCount).to.equal(0, 'should have called shouldUpdate none'); // Update 1
			expect(renderCount).to.equal(1, 'should have called "render" once'); // Rendered 1 time

			render(<StatelessComponent onComponentShouldUpdate={() => { onComponentShouldUpdateCount++; return true; }} />, container);
			expect(onComponentShouldUpdateCount).to.equal(1, 'should have called shouldUpdate once'); // Update 2
			expect(renderCount).to.equal(2, 'should have called "render" twice'); // Rendered 2 time
		});

		it('"onComponentShouldUpdate" hook should fire, should not call render when return false', () => {
			let onComponentShouldUpdateCount = 0;
			let renderCount = 0;
			const StatelessComponent = () => { renderCount++; return null; };

			render(<StatelessComponent onComponentShouldUpdate={() => { onComponentShouldUpdateCount++; return false; }} />, container);
			expect(onComponentShouldUpdateCount).to.equal(0, 'should have called shouldUpdate none'); // Update 1
			expect(renderCount).to.equal(1, 'should have called "render" once'); // Rendered 1 time

			render(<StatelessComponent onComponentShouldUpdate={() => { onComponentShouldUpdateCount++; return false; }} />, container);
			expect(onComponentShouldUpdateCount).to.equal(1, 'should have called shouldUpdate once'); // Update 2
			expect(renderCount).to.equal(1, 'should have called "render" once'); // Rendered 1 time
		});
`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: false, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
