import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [ vue() ],
  root: './src',
  build: {
    outDir: '../../build/public',
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, '../common/src')
    }
  }
})
