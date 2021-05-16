// rollup.config.js
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/server/main.ts',
  output: {
    dir: 'build/server',
    format: 'es',
  },
  external: [
    "express",
    "multer",
    "body-parser",
    "v8",
    "fs",
    "ws",
    "image-size",
    "exif",
    "sharp",
    "url",
    "path",
  ],
  plugins: [typescript({
    "tsconfig": "tsconfig.server.json"
  })],
};
