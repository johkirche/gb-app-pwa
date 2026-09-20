import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { precacheGlobPatterns, precacheMaxFileSize } from '@/config/pwaPrecache';

/*
 * What the app takes into the pew, asserted.
 *
 * The precache is the whole of "works offline", and it fails quietly in both
 * directions. Too little: the hymnal's own Optima shipped as .otf while the
 * glob listed only .woff and .woff2, so every verse fell back to Candara the
 * moment the phone left the wifi — and the CSS beside it said "precached by the
 * PWA". Too much: 2.4 MB of SystemJS for browsers that cannot install a PWA in
 * the first place, competing for the same storage the notation blobs need.
 *
 * Neither shows up on the machine it was written on, which is why they are
 * tests rather than a note.
 */

const ROOT = resolve(__dirname, '..', '..');

/** The extensions the globs actually sweep up, out of '**\/*.{a,b,c}'. */
const PRECACHED_EXTENSIONS = new Set(
    precacheGlobPatterns.flatMap((pattern) => {
        const braced = pattern.match(/\{([^}]+)\}/);
        if (braced) return braced[1].split(',').map((ext) => ext.trim());
        const single = pattern.match(/\.([a-z0-9]+)$/i);
        return single ? [single[1]] : [];
    }),
);

function filesUnder(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...filesUnder(full));
        else out.push(full);
    }
    return out;
}

function posix(path: string) {
    return relative(ROOT, path).split(sep).join('/');
}

function extensionOf(path: string) {
    return path.split('.').pop()!.toLowerCase();
}

// The two trees that reach the build as files rather than as code: public/ is
// copied verbatim, src/assets/ is hashed into dist/assets with its extension
// intact. Everything in both has to survive going offline.
const SHIPPED = [
    ...filesUnder(resolve(ROOT, 'public')),
    ...filesUnder(resolve(ROOT, 'src/assets')),
];

describe('precache globs', () => {
    it('covers every format the app ships', () => {
        const uncovered = SHIPPED.filter(
            (file) => !PRECACHED_EXTENSIONS.has(extensionOf(file)),
        ).map(posix);

        expect(uncovered).toEqual([]);
    });

    it('covers every font face the theme declares', () => {
        // A @font-face the precache misses is a face that only exists online —
        // and the hymn page is the one place the app cannot substitute, because
        // the Notenbild carries the same face baked into outlines.
        const css = readFileSync(resolve(ROOT, 'src/theme/main.css'), 'utf8');
        const urls = [...css.matchAll(/url\(['"]?([^)'"]+)/g)].map(([, url]) => url);

        expect(urls.length).toBeGreaterThan(0);
        for (const url of urls) {
            expect(PRECACHED_EXTENSIONS.has(extensionOf(url)), `${url} is never precached`).toBe(
                true,
            );
        }
    });

    it('lets the largest shipped file through the size limit', () => {
        // workbox drops an oversized file from the manifest SILENTLY: no
        // warning at build time, no entry in the service worker, and playback
        // that works on the desk and not in the pew. The soundfonts are ~2.7 MB
        // each and sit closest to this ceiling.
        const tooLarge = SHIPPED.filter(
            (file) =>
                PRECACHED_EXTENSIONS.has(extensionOf(file)) &&
                statSync(file).size > precacheMaxFileSize,
        ).map((file) => `${posix(file)} (${(statSync(file).size / 1024 / 1024).toFixed(2)} MiB)`);

        expect(tooLarge).toEqual([]);
    });
});

describe('what the service worker is told to cache', () => {
    const config = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8');

    it('is this module, and not a second list beside it', () => {
        // A config module the build does not import is a config nothing applies.
        expect(config).toContain('globPatterns: precacheGlobPatterns');
        expect(config).toContain('maximumFileSizeToCacheInBytes: precacheMaxFileSize');
        // includeAssets named the twelve icons that globPatterns already
        // sweeps, and put every one of them in the manifest twice.
        expect(config).not.toContain('includeAssets:');
    });

    it('builds one bundle, not a legacy one beside it', () => {
        // @vitejs/plugin-legacy doubled the precache with SystemJS chunks for
        // browsers that cannot install a PWA at all. The build target (es2020)
        // and .browserslistrc already say who this app is for.
        expect(config).not.toContain('plugin-legacy');
        const pkg: { devDependencies?: Record<string, string> } = JSON.parse(
            readFileSync(resolve(ROOT, 'package.json'), 'utf8'),
        );
        expect(pkg.devDependencies?.['@vitejs/plugin-legacy']).toBeUndefined();
    });

    it('registers no runtime route that can never fire', () => {
        // Three rules once stood here — a REST path the app never requests, and
        // extension matches for images and fonts that the precache answers
        // first. None could match a single real request, and all three sent
        // anyone debugging an offline failure to look in an empty cache. The
        // key, not the word: vite.config.ts says in prose why it has none.
        expect(config).not.toContain('runtimeCaching:');
    });
});
