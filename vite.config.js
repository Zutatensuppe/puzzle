import vite from 'vite'
import vue from '@vitejs/plugin-vue'

export default vite.defineConfig({
  plugins: [ vue() ],
  root: './src/frontend',
  build: {
    outDir: '../../build/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '^/(api|uploads)/.*': {
        target: 'http://localhost:1337',
        secure: false,
      },
      '^/upload': {
        target: 'http://localhost:1337',
        secure: false,
      },
    },
  },
})
