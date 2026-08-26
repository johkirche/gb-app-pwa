/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import { createRequire } from 'node:module';
import path from 'path';
import { type ConfigEnv, type Plugin, type UserConfig, defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import vueDevTools from 'vite-plugin-vue-devtools';

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
        legacy({
            targets: ['defaults', 'not IE 11'],
        }),
        vueDevTools(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: [
                'favicon.ico',
                'favicon.png',
                'favicon-16x16.png',
                'favicon-32x32.png',
                'apple-touch-icon.png',
                'apple-touch-icon-120.png',
                'apple-touch-icon-152.png',
                'apple-touch-icon-167.png',
                'android-chrome-192x192.png',
                'android-chrome-512x512.png',
                'logo.svg',
                'logo-black.png',
            ],
            manifest: {
                name: 'Johannische Kirche Gesangbuch',
                short_name: 'Gesangbuch',
                description: 'Das digitale Gesangbuch der Johannischen Kirche',
                theme_color: '#273c77',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'pwaicons/android/android-launchericon-192-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwaicons/android/android-launchericon-512-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'pwaicons/android/maskable-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: 'pwaicons/android/maskable-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                // Cache all assets for offline use
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                // Runtime caching for API requests
                runtimeCaching: [
                    {
                        // Cache API requests
                        urlPattern: /^https:\/\/.*\/items\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // Cache images
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'image-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                        },
                    },
                    {
                        // Cache fonts
                        urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'font-cache',
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                            },
                        },
                    },
                ],
                // The self-hosted soundfonts (public/soundfonts/*.js, ~2.7 MB each) must
                // land in the precache so playback works offline before the first play.
                // They match globPatterns '**/*.js', but workbox's default
                // maximumFileSizeToCacheInBytes (2 MiB) would SILENTLY exclude them.
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                // Don't cache the service worker itself
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
    },
});
