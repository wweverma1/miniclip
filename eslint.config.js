import js from '@eslint/js'
import globals from 'globals'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Only .ts/.tsx are linted — build scripts (scripts/*.mjs) and root config
// files run under Node, not the browser globals configured below.
const tsFiles = ['**/*.{ts,tsx}']

export default [
  {
    // *.d.ts are ambient declaration-merging files (see src/vite-env.d.ts,
    // electron/electron-env.d.ts) — no-unused-vars flags their global
    // `interface X` augmentations as "unused", which is a false positive
    // for this file type.
    ignores: ['dist', 'dist-electron', 'release', '**/*.d.ts'],
  },
  {
    files: tsFiles,
    ...js.configs.recommended,
  },
  ...tseslint.configs['flat/recommended'].map((config) => ({
    ...config,
    files: tsFiles,
  })),
  {
    files: tsFiles,
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
      parser: tsparser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // This is a plain Electron+IPC app with no router/loader/framework
      // data layer — fetching initial state via setState-in-a-mount-effect
      // (see App.tsx's refreshItems() call) is the idiomatic pattern here,
      // not the cascading-render anti-pattern this rule targets.
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
