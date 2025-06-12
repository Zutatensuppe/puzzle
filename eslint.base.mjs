import { fileURLToPath } from 'url'
import { dirname } from 'path'

export default {
  dirname: (importMetaUrl) => {
    const __filename = fileURLToPath(importMetaUrl)
    return dirname(__filename)
  },
  rules: [
    {
      rules: {
        'semi': ['error', 'never'],
        'quotes': ['error', 'single', {
          avoidEscape: true,
          allowTemplateLiterals: true,
        }],
        'comma-dangle': ['error', 'always-multiline'],
        'no-void': ['error', { allowAsStatement: true }],
        'require-await': 'error',
        'space-infix-ops': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '(^log$|^_)',
          },
        ],
        'vue/multi-word-component-names': 'off',
      },
    },
  ],
}
