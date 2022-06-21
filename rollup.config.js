import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from "rollup-plugin-terser";
import babel from 'rollup-plugin-babel';
import replace from "@rollup/plugin-replace";

export default [
  // browser-friendly UMD build
  {
    input: 'lib/index.js',
    output: {
      name: 'babel-plugin-inferno',
      file: 'dist/index.umd.js',
      format: 'umd'
    },
    plugins: [
      resolve(),  // so Rollup can find `ms`
      commonjs(), // so Rollup can convert `ms` to an ES module
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.BABEL_TYPES_8_BREAKING': true
      }),
      babel({
        "presets": [
          [
            "@babel/preset-env",
            {
              "targets": {
                "ie": "11"
              }
            }
          ]
        ]
      }),
      terser({
        compress: {
          ecma: 5,
          inline: true,
          if_return: false,
          reduce_funcs: false,
          passes: 5,
          comparisons: false
        },
        ie8: false,
        mangle: {
          toplevel: true
        },
        parse: {
          html5_comments: false,
          shebang: false
        },
        toplevel: false,
        warnings: false
      })
    ]
  }
];
