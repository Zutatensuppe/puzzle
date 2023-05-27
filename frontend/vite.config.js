import viteConfigBuild from './vite.config.build.js'

import vite from 'vite'
import fs from 'fs'

// TODO: replace with import, when esm json import is available
const cfg = JSON.parse(String(fs.readFileSync('../config.json')))

export default vite.defineConfig(Object.assign({}, viteConfigBuild, {
  server: {
    proxy: {
      '^/(admin/api|api|uploads|image-service)/.*': {
        target: `http://${cfg.http.hostname}:${cfg.http.port}`,
        secure: false,
      },
    },
  },
}))
