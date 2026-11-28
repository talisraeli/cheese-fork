// Vite+ for the site: `vp dev`, `vp build`, `vp test`, `vp lint` and `vp fmt`.

import { defineConfig } from 'vite-plus';
import { writeBundles } from './tools/bundles.ts';
import { servedBundles } from './tools/dev-server.ts';

// Built, vendored and generated files, which are neither linted nor formatted.
const GENERATED = [
    'dist/**',
    'share-histograms.js',
    'modules/**',
    'catalog-en/**',
    'functions/build/**',
    'functions/shared/**',
    'functions/hosting-public/**',
    '**/node_modules/**'
];

export default defineConfig({
    // The pages are served as they are, from the root, as GitHub Pages serves them.
    appType: 'mpa',
    publicDir: false,
    plugins: [servedBundles()],
    optimizeDeps: { noDiscovery: true, include: [] },
    builder: {
        // The site isn't an app that Vite builds from its pages: the bundles that the pages load
        // are built into dist/, which is committed, since Pages serves the repository as it is.
        async buildApp(builder) {
            const files = await writeBundles();
            console.log('Built ' + files.length + ' files: ' + files.join(', '));
            // Otherwise Vite builds its environments after this, which would bundle the pages.
            for (const environment of Object.values(builder.environments)) {
                environment.isBuilt = true;
            }
        }
    },
    test: {
        include: ['tests/**/*.test.ts'],
        globalSetup: ['tests/setup.ts'],
        // The tests load the site's libraries into jsdom pages, which takes a while.
        testTimeout: 60000,
        hookTimeout: 60000
    },
    lint: {
        ignorePatterns: GENERATED,
        plugins: ['typescript', 'unicorn', 'oxc'],
        categories: { correctness: 'error' },
        rules: {
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'typescript/no-explicit-any': 'error',
            // The code keeps `this` as `that` for the callbacks that get their own this.
            'typescript/no-this-alias': ['error', { allowedNames: ['that'] }]
        },
        overrides: [
            {
                // Scripts the pages load as they are: the semesters, the locale catalogs.
                files: ['data/**/*.js', 'locales/**/*.js'],
                env: { browser: true },
                globals: { CheeseI18n: 'readonly' },
                rules: { 'no-undef': 'error', 'no-var': 'off' }
            },
            {
                // Defines the global availableSemesters, which the pages and the API read.
                files: ['data/semesters.js'],
                rules: { 'no-unused-vars': 'off' }
            }
        ]
    },
    fmt: {
        printWidth: 120,
        tabWidth: 4,
        singleQuote: true,
        trailingComma: 'none',
        arrowParens: 'avoid',
        ignorePatterns: [
            ...GENERATED,
            // Rewritten by ci/semester_update.py, which expects its layout.
            'data/**',
            // Templates whose whitespace render() handles, and documents.
            '**/*.html',
            '**/*.md',
            // Written by pnpm, with its own layout.
            '**/package.json',
            '**/pnpm-lock.yaml',
            '**/pnpm-workspace.yaml'
        ]
    }
});
