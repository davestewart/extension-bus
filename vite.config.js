const path = require('path')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  build: {
    sourcemap: true,
    minify: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'bus',
      fileName: (format) => `bus.${format}.js`
    }
  }
})
