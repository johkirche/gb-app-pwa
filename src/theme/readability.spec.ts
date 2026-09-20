import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { pwaManifest } from '@/config/pwaManifest';

/*
 * The readability floor, asserted.
 *
 * Every rule below was broken once and cost a reader something: a page that
 * could not be pinched, an app locked to portrait, a Größe setting that reached
 * the songs and stopped, type nailed to a pixel size that no setting moves.
 * They are cheap to break again by accident — a copied meta tag, a `text-[15px]`
 * pasted from an old component — and expensive to notice, because nothing looks
 * wrong on the machine it was written on. So they are tests.
 */

const ROOT = resolve(__dirname, '..', '..');

function sourceFiles(dir: string, exts: string[]): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...sourceFiles(full, exts));
        else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
    return out;
}

// Shipped UI only: a spec may name a banned pattern in order to ban it.
const SRC_FILES = sourceFiles(resolve(ROOT, 'src'), ['.vue', '.ts']).filter(
    (file) => !file.endsWith('.spec.ts'),
);

function read(path: string) {
    return readFileSync(resolve(ROOT, path), 'utf8');
}

function posix(path: string) {
    return relative(ROOT, path).split(sep).join('/');
}

describe('viewport', () => {
    const viewport = (() => {
        const match = read('index.html').match(/<meta\s+name="viewport"\s+content="([^"]+)"/);
        if (!match) throw new Error('index.html has no viewport meta tag');
        return Object.fromEntries(
            match[1].split(',').map((part) => {
                const [key, value] = part.split('=');
                return [key.trim(), (value ?? '').trim()];
            }),
        ) as Record<string, string>;
    })();

    it('lets the reader zoom', () => {
        // WCAG 1.4.4 wants 200%. The hymnal is held at arm's length in a pew:
        // whatever the app's own Größe reaches, the pinch has to go further.
        expect(viewport['user-scalable']).not.toBe('no');
        expect(viewport['maximum-scale']).toBeUndefined();
    });

    it('still fits the notch and starts at 1:1', () => {
        expect(viewport['viewport-fit']).toBe('cover');
        expect(viewport['width']).toBe('device-width');
        expect(viewport['initial-scale']).toBe('1.0');
    });

    it('declares the document language', () => {
        // Without it a screen reader reads German hymn titles in its own locale.
        expect(read('index.html')).toMatch(/<html\s+lang="de"/);
    });
});

describe('web app manifest', () => {
    it('does not lock the orientation', () => {
        // Turning the phone sideways is a reader's decision, and the one that
        // gets the longest verse lines out of a narrow screen.
        expect(pwaManifest).not.toHaveProperty('orientation');
    });

    it('declares the app language', () => {
        expect(pwaManifest.lang).toBe('de');
        expect(pwaManifest.dir).toBe('ltr');
    });
});

describe('one scale for the whole app', () => {
    const css = read('src/theme/main.css');

    it('drives the root font size from the reader’s setting', () => {
        // The single line that carries Größe into every rem in the codebase.
        expect(css).toMatch(/html\s*\{[^}]*font-size:\s*calc\(100%\s*\*\s*var\(--app-scale/);
        expect(css).toMatch(/--app-scale:\s*clamp\([^)]*var\(--page-scale\)/);
    });

    it('is written onto the root by the app shell', () => {
        // A composable nothing calls is a setting nothing applies.
        expect(read('src/composables/usePageScale.ts')).toContain('--page-scale');
        expect(read('src/App.vue')).toContain('usePageScale()');
    });

    it('keeps the printed geometry off rem', () => {
        // --page-col-max and --notation-max describe the page, not the type. In
        // rem they would grow with the setting — the column widening by exactly
        // the factor the type does, so the reader drags the slider and the song
        // page never changes; and the engraving, already drawn at --page-scale,
        // would take the factor twice.
        for (const token of ['--page-col-max', '--notation-max']) {
            const declarations = [...css.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))];
            expect(declarations.length).toBeGreaterThan(0);
            for (const [, value] of declarations) expect(value).not.toMatch(/\d\s*rem/);
        }
    });

    it('keeps focused fields at 16px or more on touch', () => {
        // Under that, iOS zooms the page the moment a field is tapped — and
        // leaves the reader there.
        expect(css).toMatch(/font-size:\s*max\(1rem,\s*16px\)/);
    });
});

describe('type sizes follow the setting', () => {
    it('states no font size in px', () => {
        // px is the one unit the reader cannot move. Everything the app sets
        // type in is rem, so it all grows together.
        const offenders: string[] = [];

        for (const file of SRC_FILES) {
            const body = readFileSync(file, 'utf8');
            for (const [match] of body.matchAll(/text-\[\d[\d.]*px\]/g)) {
                offenders.push(`${posix(file)}: ${match}`);
            }
        }

        expect(offenders).toEqual([]);
    });

    it('sizes the icons that sit with type in rem too', () => {
        // An icon nailed to 18px beside a label that grew to 1.6x is a tab that
        // looks broken. Boxes go up with the words they belong to.
        const allowed = new Set([
            // A phone frame in a dev-only preview: 390x844 is the device, not
            // the type, and it must not move when the reader's Größe does.
            'src/components/dev/DevViewportPreview.vue',
        ]);
        const offenders: string[] = [];

        for (const file of SRC_FILES) {
            if (allowed.has(posix(file))) continue;
            for (const [match] of readFileSync(file, 'utf8').matchAll(
                /\b(?:size|h|w|min-h|min-w|max-h|max-w)-\[\d[\d.]*px\]/g,
            )) {
                offenders.push(`${posix(file)}: ${match}`);
            }
        }

        expect(offenders).toEqual([]);
    });

    it('states no font-size in px outside the drawn surfaces', () => {
        // Three files may: two draw inside an SVG viewBox, where px is a user
        // unit that scales with the drawing, and the index rail is aimed at
        // rather than read — each says so where it does it.
        const allowed = new Set([
            'src/components/songlist/IndexScroll.vue',
            'src/components/songview/SongPlaybackPreview.vue',
            'src/components/songview/SongScalePreview.vue',
        ]);
        const offenders: string[] = [];

        for (const file of SRC_FILES.filter((f) => f.endsWith('.vue'))) {
            if (allowed.has(posix(file))) continue;
            for (const [match] of readFileSync(file, 'utf8').matchAll(/font-size:\s*\d[\d.]*px/g)) {
                offenders.push(`${posix(file)}: ${match}`);
            }
        }

        expect(offenders).toEqual([]);
    });
});
