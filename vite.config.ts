/// <reference types="vitest" />
import legacy from '@vitejs/plugin-legacy';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        legacy({
            targets: ['defaults', 'not IE 11'],
        }),
        vueDevTools(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
                'favicon.ico',
                'favicon.png',
                'favicon-16x16.png',
                'favicon-32x32.png',
                'apple-touch-icon.png',
                'android-chrome-192x192.png',
                'android-chrome-512x512.png',
                'logo.svg',
                'logo-black.png',
            ],
            manifest: {
                name: 'Johannische Kirche Gesangbuch',
                short_name: 'Gesangbuch',
                description: 'Das digitale Gesangbuch der Johannischen Kirche',
                theme_color: '#3880ff',
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
                        src: 'pwaicons/android/android-launchericon-512-512.png',
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
                    {
                        // Cache MIDI soundfonts used by osmd-audio-player
                        // (gleitz/midi-js-soundfonts: MusyngKite or FluidR3_GM, ~1-5 MB per instrument)
                        urlPattern: /^https:\/\/gleitz\.github\.io\/midi-js-soundfonts\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'soundfont-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                                purgeOnQuotaError: true,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                            // Soundfont files are large — allow up to ~10 MB each
                            matchOptions: {
                                ignoreVary: true,
                            },
                        },
                    },
                ],
                // Ensure the service worker takes control immediately
                clientsClaim: true,
                skipWaiting: true,
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
                drop_console: true, // Remove console.logs in production
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
                        n.includes('/node_modules/@ionic/') ||
                        n.includes('/node_modules/ionicons/')
                    )
                        return 'ionic-vendor';
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
