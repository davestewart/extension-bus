const typescript = require('rollup-plugin-typescript2')
const license = require('rollup-plugin-license')
const copy = require('rollup-plugin-copy')
const pkg = require('./package.json')

module.exports = {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'esm',
      sourcemap: true,
    }
  ],
  plugins: [
    typescript({
      useTsconfigDeclarationDir: true,
      sourceMap: false,
    }),
    copy({
      targets: [
        {
          dest: './demo/utils',
          src: [
            './dist/bus.mjs',
            './dist/bus.mjs.map',
          ],
        },
      ]
    }),
    license({
      banner: {
        content: {
          file: './LICENSE',
          encoding: 'utf-8', // Default is utf-8
        },
      },
    }),
  ]
}
