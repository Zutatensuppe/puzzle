// rollup.config.js
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/server/main.ts',
  output: {
    dir: 'build/server',
    format: 'es',
  },
  external: [
    "async-mutex",
    "compression",
    "exif",
    "express",
    "fs",
    "image-size",
    "multer",
    "path",
    "pg",
    "request",
    "sharp",
    "url",
    "v8",
    "ws",
  ],
  plugins: [typescript()],
};
