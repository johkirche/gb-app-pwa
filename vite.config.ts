/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { createRequire } from 'node:module';
import path from 'path';
import { type ConfigEnv, type Plugin, type UserConfig, defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import vueDevTools from 'vite-plugin-vue-devtools';
import { configDefaults } from 'vitest/config';

import { pwaManifest } from './src/config/pwaManifest';
import { precacheGlobPatterns, precacheMaxFileSize } from './src/config/pwaPrecache';

// pnpm's strict node_modules does not hoist vite-plugin-pwa's workbox-window
// dependency to the root, but the plugin's 'virtual:pwa-register' module imports
// 'workbox-window' from a virtual path that resolves against the project root.
// Alias it to the (self-contained ESM) copy that ships with vite-plugin-pwa so the
// import resolves without adding a direct dependency.
const require = createRequire(import.meta.url);
const workboxWindow = path.join(
    path.dirname(
        require.resolve('workbox-window/package.json', {
            paths: [path.dirname(require.resolve('vite-plugin-pwa/package.json'))],
        }),
    ),
    'build/workbox-window.prod.es5.mjs',
);

// Fail a production build immediately when VITE_BACKEND_URL is missing: without it
// the client would inline `undefined` as the backend URL and every API call on the
// deployed site would fail. loadEnv also picks up real environment variables, so a
// CI value (e.g. Cloudflare build env) satisfies the check without .env.production.
function enforceBackendUrl(): Plugin {
    return {
        name: 'enforce-backend-url',
        config(_config: UserConfig, { mode }: ConfigEnv) {
            const env = loadEnv(mode, process.cwd(), '');
            if (mode === 'production' && !env.VITE_BACKEND_URL) {
                throw new Error(
                    'VITE_BACKEND_URL is not set for the production build. ' +
                        'Commit it in .env.production or configure it in the CI build environment ' +
                        '(see docs/BACKEND_SETUP.md).',
                );
            }
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        enforceBackendUrl(),
        vue(),
        tailwindcss(),
        vueDevTools(),
        VitePWA({
            registerType: 'prompt',
            manifest: pwaManifest,
            // The manifest's icons are not listed for the precache a second
            // time: globPatterns already sweeps the whole build output, and
            // naming them twice only duplicated their entries.
            includeManifestIcons: false,
            workbox: {
                globPatterns: precacheGlobPatterns,
                maximumFileSizeToCacheInBytes: precacheMaxFileSize,
                // Deliberately no runtimeCaching. At run time the app talks to
                // exactly three things, and a workbox route can match none of
                // them: the GraphQL endpoint and Directus' auth routes are
                // POSTs, and /assets/<uuid> carries an Authorization header,
                // has no file extension, and is stored in IndexedDB by the
                // sync — caching it in the service worker would hold ~87 MB of
                // notation twice. The three rules that used to stand here (a
                // NetworkFirst on an /items/ REST path the app never requests,
                // and extension matches for images and fonts that the precache
                // answers first) could not fire once between them, and sent
                // anyone debugging an offline failure looking in caches that
                // are always empty.
                cleanupOutdatedCaches: true,
            },
            devOptions: {
                enabled: true,
                suppressWarnings: true,
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'workbox-window': workboxWindow,
        },
    },
    optimizeDeps: {
        exclude: ['@directus/sdk'],
    },
    build: {
        // Enable minification
        minify: 'terser',
        // Terser options for advanced minification and obfuscation
        terserOptions: {
            compress: {
                // Deliberately NO drop_console: console.warn/console.error must
                // survive so production failures (e.g. SW registration errors)
                // stay diagnosable after go-live — silent errors were the core
                // complaint in issue #10. Only log/info/debug are stripped.
                drop_debugger: true, // Remove debugger statements
                pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific functions
                passes: 2, // Run compress twice for better optimization
            },
            mangle: {
                // Enable name mangling (obfuscation)
                toplevel: true,
                safari10: true,
                // Properties to keep readable (adjust as needed)
                reserved: ['$', 'exports', 'require'],
            },
            format: {
                comments: false, // Remove all comments
                ecma: 2020,
            },
        },
        // Source maps (disable in production for better security)
        sourcemap: process.env.NODE_ENV !== 'production' ? 'inline' : false,
        // Chunk size optimization
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                // Rolldown (Vite 8) requires manualChunks to be a function, not an object map
                manualChunks(id: string) {
                    const n = id.replace(/\\/g, '/');
                    if (!n.includes('/node_modules/')) return;
                    if (n.includes('/node_modules/@directus/sdk/')) return 'directus-vendor';
                    if (
                        n.includes('/node_modules/vue-router/') ||
                        n.includes('/node_modules/pinia/') ||
                        /\/node_modules\/vue\//.test(n) ||
                        /\/node_modules\/@vue\//.test(n)
                    )
                        return 'vue-vendor';
                },
                // Obfuscate chunk names
                chunkFileNames: `assets/[name]-[hash].js`,
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]',
            },
        },
        // CSS minification
        cssMinify: true,
        // Target modern browsers
        target: 'es2020',
        // Optimize bundle size
        reportCompressedSize: true,
        // Polyfills
        modulePreload: {
            polyfill: true,
        },
    },
    server: {
        port: 8100,
        strictPort: true,
    },
    test: {
        globals: true,
        environment: 'jsdom',
        // tests/e2e belongs to Playwright, and its specs are named *.spec.ts
        // like the unit ones — vitest would otherwise load them and fail on a
        // `test.use` it has no browser for. (Cypress's .cy.ts names kept the
        // two apart by accident; nothing was ever declared.)
        exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    },
});
