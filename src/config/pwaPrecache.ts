/**
 * What the service worker precaches, kept out of vite.config.ts so it can be
 * asserted on — see pwaPrecache.spec.ts. Nothing in the app imports it at
 * runtime; it is build configuration that happens to be worth a test.
 *
 * One sweep over the build output rather than a hand-kept list of files: a
 * second list is a list that goes stale, and the one that stood here named the
 * twelve icons a second time and put sixteen duplicate entries in the manifest
 * for it. The extensions are the whole statement, so an asset shipped in a
 * format nobody thought to add — the hymnal's own Optima, an .otf among all
 * those .woff2 — is simply absent offline, with nothing saying so.
 */
export const precacheGlobPatterns = ['**/*.{js,css,html,ico,png,svg,woff,woff2,otf}'];

/**
 * The self-hosted soundfonts (public/soundfonts/*.js, ~2.7 MB each) must land
 * in the precache so playback works offline before the first play. They match
 * the '**\/*.js' pattern above, but workbox's default of 2 MiB would SILENTLY
 * exclude them — no warning, no entry, and a hymn that plays on the desk and
 * not in the pew.
 */
export const precacheMaxFileSize = 5 * 1024 * 1024;
