'use strict';

const babel = require('babel-core');
const plugin = require('./lib/index');

const code = `
import Inferno from 'inferno';
import createClass from 'inferno-create-class';
import {StaggeredMotion, spring, presets} from '../../src/inferno-motion';
import range from 'lodash.range';

const Demo = createClass({
  getInitialState() {
    return {x: 250, y: 300};
  },

  componentDidMount() {
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('touchmove', this.handleTouchMove);
  },

  handleMouseMove({pageX: x, pageY: y}) {
    this.setState({x, y});
  },

  handleTouchMove({touches}) {
    this.handleMouseMove(touches[0]);
  },

  getStyles(prevStyles) {
    const endValue = prevStyles.map((_, i) => {
      return i === 0
        ? this.state
        : {
            x: spring(prevStyles[i - 1].x, presets.gentle),
            y: spring(prevStyles[i - 1].y, presets.gentle),
          };
    });
    return endValue;
  },

  render() {
    return (
      <StaggeredMotion
        defaultStyles={range(6).map(() => ({x: 0, y: 0}))}
        styles={this.getStyles}>
        {balls =>
          <div className="demo1">
            {balls.map(({x, y}, i) =>
              <div
                key={i}
                style={{
                  zIndex: balls.length - i,
                }} />
            )}
          </div>
        }
      </StaggeredMotion>
    );
  },
});

export default Demo;

`;

const output = babel.transform(code, {
	plugins: [[ plugin, { inline: true, preclone: true }], 'syntax-jsx' ],
	presets: ['es2015']
}).code;

console.log(output);
