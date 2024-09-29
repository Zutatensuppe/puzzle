import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"
import base from "../eslint.base.mjs"

export default [
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
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
