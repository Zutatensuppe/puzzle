import vite from 'vite'
import vue from '@vitejs/plugin-vue'

export default vite.defineConfig({
  plugins: [ vue() ],
  root: './src',
  build: {
    outDir: '../../build/public',
    emptyOutDir: true,
    sourcemap: true,
  },
})
