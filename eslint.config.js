import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-plugin-prettier/recommended';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

const isProduction = process.env.NODE_ENV === 'production';

export default [
    {
        ignores: [
            '.DS_Store',
            'node_modules/',
            'coverage/',
            'dist/',
            'dev-dist/',
            // Vendored assets (soundfont data files) — not our code style
            'public/',
            // Directus extension: deployed server-side, has its own Node context
            'directus-extensions/',
            'ios/',
            'android/',
            '.env.local',
            '.env.*.local',
            '**/*-debug.log*',
            '.idea/',
            '.vscode/',
            '*.suo',
            '*.ntvs*',
            '*.njsproj',
            '*.sln',
            '*.sw?',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    eslintConfigPrettier,
    {
        files: ['*.js', '*.mjs', '*.cjs', '*.config.{js,ts}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['**/*.vue', '**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tseslint.parser,
                ecmaVersion: 2020,
                sourceType: 'module',
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            'no-console': isProduction ? 'warn' : 'off',
            'no-debugger': isProduction ? 'warn' : 'off',
            'vue/no-deprecated-slot-attribute': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        // shadcn-vue-style UI kit: primitives are idiomatically single-word (Button, Input, …)
        files: ['src/components/ui/**/*.vue'],
        rules: {
            'vue/multi-word-component-names': 'off',
        },
    },
];
