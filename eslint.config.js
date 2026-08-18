import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

function isAllowedEslintDirective(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('eslint-disable-next-line')) {
    return true;
  }

  return false;
}

const noCommentPlugin = {
  rules: {
    'no-comment': {
      meta: {
        type: 'problem',
      },
      create(context) {
        return {
          Program() {
            const comments = context.sourceCode.getAllComments();
            for (const comment of comments) {
              if (isAllowedEslintDirective(comment.value)) {
                continue;
              }

              context.report({
                loc: comment.loc,
                message: 'Comments are forbidden',
              });
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-cjs/**', 'node_modules/**', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.ts'],
    plugins: {
      'no-comment': noCommentPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'no-ternary': 'error',
      'no-else-return': 'error',
      'func-style': ['error', 'declaration', { allowArrowFunctions: false }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-comment/no-comment': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/\\.(js|ts)$/]',
          message: 'Imports must not include a file extension',
        },
        {
          selector: 'ExportNamedDeclaration[source.value=/\\.(js|ts)$/]',
          message: 'Imports must not include a file extension',
        },
        {
          selector: 'ExportAllDeclaration[source.value=/\\.(js|ts)$/]',
          message: 'Imports must not include a file extension',
        },
      ],
    },
  },
);
