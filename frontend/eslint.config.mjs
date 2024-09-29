import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"
import pluginVue from "eslint-plugin-vue"
import base from '../eslint.base.mjs'

export default [
  {files: ["**/*.{js,mjs,cjs,ts,vue}"]},
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: true,
        tsconfigRootDir: base.dirname(import.meta.url),
      }
    },
  },
  { ignores: ['src/shims-vue.d.ts'] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {files: ["**/*.vue"], languageOptions: {parserOptions: {parser: tseslint.parser}}},
  {
    plugins: {
      'typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        project: true,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
  },
  ...base.rules
]
