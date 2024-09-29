import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"
import base from '../eslint.base.mjs'

export default [
  {files: ["**/*.{js,mjs,cjs,ts,vue}"]},
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: true,
        tsconfigRootDir: base.dirname(import.meta.url),
      }
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...base.rules,
]
