// rollup.config.js
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/server/main.ts',
  output: {
    dir: 'build/server',
    format: 'es',
  },
  external: [
    "better-sqlite3",
    "compression",
    "exif",
    "express",
    "fs",
    "image-size",
    "multer",
    "path",
    "sharp",
    "url",
    "v8",
    "ws",
  ],
  plugins: [typescript()],
};
