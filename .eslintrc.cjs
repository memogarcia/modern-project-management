// ESLint 8 config (flat config migration pending).
module.exports = {
  root: true,
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.next/',
    'out/',
    'coverage/',
    'shared/',
    'scripts/',
  ],
  extends: ['eslint:recommended'],
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      parserOptions: {
        project: ['./app/tsconfig.json', './mcp-server/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-deprecated': 'warn',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/ban-ts-comment': [
          'warn',
          {
            'ts-expect-error': 'allow-with-description',
            'ts-ignore': true,
            'ts-nocheck': true,
          },
        ],
      },
    },
    {
      files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['app/**/*.{js,jsx,ts,tsx}'],
      extends: ['next/core-web-vitals'],
    },
    // Tailwind CSS design system rules
    // DISABLED: eslint-plugin-tailwindcss is incompatible with Tailwind 4.0
    // See: https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/428
    // TODO: Re-enable when plugin supports TW4
    // {
    //   files: ['app/**/*.{tsx,jsx}'],
    //   plugins: ['tailwindcss'],
    //   rules: {
    //     'tailwindcss/no-arbitrary-value': 'warn',
    //     'tailwindcss/classnames-order': 'warn',
    //   },
    //   settings: {
    //     tailwindcss: {
    //       callees: ['cn', 'cva', 'clsx'],
    //     },
    //   },
    // },
  ],
};
