/**
 * The web app manifest, kept out of vite.config.ts so it can be asserted on —
 * see readability.spec.ts. Nothing in the app imports it at runtime; it is
 * build configuration that happens to be worth a test.
 */
export const pwaManifest = {
    name: 'Johannische Kirche Gesangbuch',
    short_name: 'Gesangbuch',
    description: 'Das digitale Gesangbuch der Johannischen Kirche',
    // The app is German throughout — screen readers and the installed app's
    // title need to be told, or they fall back to the platform locale and
    // pronounce the hymn titles in it.
    lang: 'de',
    dir: 'ltr' as const,
    theme_color: '#273c77',
    background_color: '#ffffff',
    display: 'standalone' as const,
    // Deliberately no `orientation`: a reader who has turned the phone
    // sideways to get longer verse lines, or who props a tablet in a stand,
    // has said what they want. Locking to portrait overrules them and gains
    // the app nothing — every page already lays out at any width.
    scope: '/',
    start_url: '/',
    // The app naming itself, so a page in a browser tab can ask whether it is
    // installed (usePWA, navigator.getInstalledRelatedApps). Chrome on Android
    // answers yes when a WebAPK bound to this manifest's URL is on the phone;
    // the url resolves against the manifest's own, which is what a relative
    // path here means.
    // Without an `id`: Chrome on the desktop wants the app's id as an absolute
    // URL, which ties the manifest to one origin. The desktop keeps its guess,
    // and the button into the app that Chrome puts in its address bar.
    related_applications: [{ platform: 'webapp', url: 'manifest.webmanifest' }],
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
};
