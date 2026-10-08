import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', '.dependency-cruiser.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      // Стандарт: конфігурація читається лише в src/config (див. standards/checks.md, C-07)
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Читайте env лише через src/config.' },
      ],
    },
  },
  {
    files: ['src/config/**', 'test/**', 'scripts/**'],
    rules: { 'no-restricted-properties': 'off' },
  },
  prettier,
);
