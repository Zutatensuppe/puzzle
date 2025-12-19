import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [ tsconfigPaths(), vue() ],
  root: './src',
  build: {
    outDir: '../../build/public',
    emptyOutDir: true,
    sourcemap: true,
  },
  paths: {
    '@common/*': ['../common/src']
  }
})
