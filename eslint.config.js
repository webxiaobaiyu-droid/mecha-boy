/* ESLint 扁平配置（Flat Config）：
 * 组合 = JS 推荐 + TS 推荐 + Vue3 推荐 + Prettier 收尾（关掉与格式冲突的规则）
 * 运行：npm run lint / npm run lint:fix
 */

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'legacy/**',
      'coverage/**',
      'display-pilot-front/**',
      '**/.nuxt/**',
      '**/.output/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    }
  },
  prettier,
  {
    rules: {
      // 组件名已是多词（TitleScreen/GameCanvas…），App.vue 由官方规则默认豁免
      'vue/multi-word-component-names': 'off',
      // 测试与调试代码允许显式 any，统一降为警告
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
