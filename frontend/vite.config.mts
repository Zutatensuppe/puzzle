import viteConfigBuild from './vite.config.build.mjs'

import { defineConfig } from 'vite'
import cfg from '../config.json'

export default defineConfig(Object.assign({}, viteConfigBuild, {
  server: {
    proxy: {
      '^/(admin/api|api|uploads|image-service)/.*': {
        target: `http://${cfg.http.hostname}:${cfg.http.port}`,
        secure: false,
      },
    },
    fs: {
      allow: ['..'] // allow parent directory
    },
  },
}))
