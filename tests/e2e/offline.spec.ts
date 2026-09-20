import type { BrowserContext, Page } from '@playwright/test';
import { chromium, expect, firefox, test, webkit } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NO_RECORDING, hasRecording } from './support/backend';
import { PHONE } from './support/library';
import { type Preview, servePreview } from './support/preview';
import { serveRecording } from './support/recorder';

/*
 * The one thing the rest of the suite cannot see: the service worker.
 *
 * Every other context is opened with `serviceWorkers: 'block'`, and for good
 * reason — a worker holding the dev server's modules between tests would make
 * the suite lie about what the app just rendered. But it also means the
 * precache, which is the whole of "works offline", has never once been
 * exercised. Its failures are exactly the quiet kind: the app goes on working
 * on the machine that built it, because that machine has the network. The
 * hymnal's own Optima was missing from the precache for months that way, with
 * the CSS three lines above the @font-face saying it was in there.
 *
 * So this one runs against the *built* app, lets the worker install, then takes
 * the network away and asks for a hymn.
 *
 * It needs `pnpm build` first and skips with a message if there is none: the
 * production worker is the subject, and the dev one is a different file with a
 * different manifest. Nothing else in the suite pays for it.
 */

// Playwright runs from the project root, the same assumption support/recorder.ts
// makes about tests/e2e/fixtures/.
const ROOT = process.cwd();
const SW = join(ROOT, 'dist', 'sw.js');

const hasBuild = existsSync(SW);
const NO_BUILD =
    'No production build in dist/ — run `pnpm build` once, then `pnpm test:e2e` ' +
    'to include the offline check.';

test.skip(!hasRecording, NO_RECORDING);
test.skip(!hasBuild, NO_BUILD);
test.describe.configure({ mode: 'serial' });

/**
 * What the build told the worker to keep, read out of the generated sw.js.
 * Asserted against the build rather than against a list typed here: this has to
 * stay true as the app grows, and a hard-coded 71 would just be edited to
 * whatever the run reported the first time it failed.
 */
function precacheManifest(): string[] {
    const source = readFileSync(SW, 'utf8');
    const start = source.indexOf('precacheAndRoute([') + 'precacheAndRoute('.length;
    let depth = 0;

    for (let i = start; i < source.length; i++) {
        if (source[i] === '[') depth++;
        else if (source[i] === ']' && --depth === 0) {
            const entries: { url: string }[] = JSON.parse(
                source.slice(start, i + 1).replace(/(\{|,)(\w+):/g, '$1"$2":'),
            );
            return entries.map((entry) => decodeURIComponent(entry.url));
        }
    }

    throw new Error('sw.js carries no precache manifest');
}

const PRECACHED = new Set(hasBuild ? precacheManifest() : []);

const backendUrl = process.env.VITE_BACKEND_URL ?? '';
const BACKEND_GLOB = `${backendUrl.replace(/\/$/, '')}/**`;

const STUB_SESSION = {
    data: {
        access_token: 'e2e-access-token',
        refresh_token: 'e2e-refresh-token',
        expires: 24 * 60 * 60 * 1000,
    },
};

const ENGINES = { chromium, firefox, webkit };

let preview: Preview;
let previewUrl: string;
let context: BrowserContext;
let page: Page;
let profile: string | undefined;
let closeBrowser: (() => Promise<void>) | undefined;

test.beforeAll(async ({ browserName }) => {
    test.setTimeout(300_000);

    preview = await servePreview(join(ROOT, 'dist'));
    previewUrl = preview.url;

    const engine = ENGINES[browserName];
    if (browserName === 'webkit') {
        // WebKit will not put a Blob into IndexedDB in an ephemeral context,
        // and the notation files are Blobs — see support/backend.ts.
        profile = mkdtempSync(join(tmpdir(), 'gb-e2e-offline-'));
        context = await engine.launchPersistentContext(profile, {
            viewport: PHONE,
            baseURL: previewUrl,
        });
    } else {
        const browser = await engine.launch();
        closeBrowser = () => browser.close();
        context = await browser.newContext({ viewport: PHONE, baseURL: previewUrl });
    }

    // Note what is deliberately absent here: `serviceWorkers: 'block'`.
    await serveRecording(context, BACKEND_GLOB);
    for (const path of ['login', 'refresh'] as const) {
        await context.route(`${backendUrl}/auth/${path}`, (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(STUB_SESSION),
            }),
        );
    }
    await context.route(`${backendUrl}/auth/logout`, (route) =>
        route.fulfill({ status: 204, body: '' }),
    );

    page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
    await context?.close();
    await closeBrowser?.();
    if (profile) rmSync(profile, { recursive: true, force: true });
    await preview?.close();
});

/** What the worker has actually stored, read back out of the Cache Storage. */
async function precachedCount(target: Page): Promise<number> {
    return target.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration?.active) return -1;

        const name = (await caches.keys()).find((key) => key.includes('precache'));
        if (!name) return -1;

        return (await (await caches.open(name)).keys()).length;
    });
}

test('installs, and stores the whole shell', async () => {
    test.setTimeout(300_000);

    await page.goto('/login');
    await page
        .getByLabel(/E-Mail/i)
        .first()
        .fill('e2e@example.invalid');
    await page
        .getByLabel(/Passwort/i)
        .first()
        .fill('e2e-password');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Weiter' }).click();
    const done = page.getByRole('button', { name: 'Fertig' });
    await done.waitFor({ state: 'visible', timeout: 240_000 });
    await done.click();
    await page.locator('nav[aria-label="Hauptnavigation"]:visible').waitFor({ timeout: 30_000 });

    // The worker registers with `immediate: true`, but storing ~8.5 MB (two
    // 2.7 MB soundfonts among it) outlives the first paint by a good way.
    // Waiting on the cache itself rather than on a toast that has a duration.
    await expect.poll(() => precachedCount(page), { timeout: 120_000 }).toBe(PRECACHED.size);

    console.log(`  ✓ ${PRECACHED.size} entries precached`);
});

test('serves the book with the network gone', async ({ browserName }) => {
    /*
     * Chromium and Firefox only, and not for want of trying.
     *
     * Playwright's WebKit will not let a worker answer a navigation it has
     * intercepted: an aborted route fails the reload outright with "Blocked by
     * Web Inspector". `setOffline` is no way round it either — Firefox answers
     * that one itself with NS_ERROR_OFFLINE before the worker is asked, which
     * is why the cut below is an abort. What would be under test on WebKit is
     * Playwright, not the precache.
     *
     * The test above still runs there, and it is the part that could differ per
     * engine: whether the worker installs and stores all of the shell. What
     * this adds is that the stored shell is *enough* — and a cache list is the
     * same list in every browser.
     */
    test.skip(
        browserName === 'webkit',
        'Playwright WebKit will not let a worker answer a navigation',
    );
    test.setTimeout(300_000);

    /*
     * First, one reload while the network is still there.
     *
     * Installed is not the same as in charge: `registerType: 'prompt'` leaves
     * out clientsClaim on purpose — a worker that seized the open tab is
     * exactly what the update toast exists to avoid — so the page that
     * triggered the install is never controlled by it. It takes a navigation.
     * Until that has happened the page is still fetching its own fonts and lazy
     * chunks over the network, which is what made the assertion at the bottom
     * of this test fail on a loaded machine before this was here.
     */
    await page.reload();
    await expect
        .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
            timeout: 60_000,
        })
        .toBe(true);

    // Everything off. Not just the backend: the app's own origin too, so a
    // shell file missing from the precache cannot be quietly fetched instead.
    // A cache hit never becomes a network request, so what reaches this handler
    // is exactly what the precache could not answer. Registered last, and
    // Playwright checks the newest handler first.
    const escaped: string[] = [];
    page.on('requestfailed', (request) => escaped.push(request.url()));
    await context.route('**/*', (route) => route.abort());

    // And now a cold start with nothing behind it.
    await page.reload();
    await expect(page.locator('nav[aria-label="Hauptnavigation"]:visible')).toBeVisible({
        timeout: 60_000,
    });

    // A hymn, read cold: the record out of IndexedDB, the page out of the
    // precache, and no network under either.
    await page.goto('/tabs/lieder');
    await expect(page.getByText('Keine Lieder vorhanden')).toBeHidden({ timeout: 30_000 });
    await page.locator('.song-row button').first().click();
    await page.waitForURL(/\/(songs|lied)\//, { timeout: 30_000 });
    await expect(page.locator('main')).toContainText(/\S/, { timeout: 30_000 });

    /*
     * The engraving, drawn with nothing behind it.
     *
     * This is the one that exercises a real dynamic import offline:
     * opensheetmusicdisplay is a 1.19 MB chunk of its own, pulled by
     * SongMelody.vue only when a Notenbild is actually opened, and the file it
     * draws comes out of IndexedDB. If either the chunk or the blob were
     * missing the page would sit on "Notenbild wird geladen...".
     */
    const notenbild = page.getByRole('img', { name: 'Notenbild' }).first();
    await expect(notenbild).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Notenbild wird geladen...')).toBeHidden();
    expect(
        await page.locator('.noten-svg svg path').count(),
        'the engraving drew no glyphs offline',
    ).toBeGreaterThan(40);

    // The face the hymnal is set in — the one the precache used to miss, so
    // every verse quietly fell back to Candara the moment a phone left the
    // wifi. `document.fonts.check` is false unless it actually loaded.
    const optima = await page.evaluate(async () => {
        await document.fonts.ready;
        return document.fonts.check('1rem GbOptima');
    });
    expect(optima, 'GbOptima did not load offline').toBe(true);

    /*
     * And nothing the shell needed was missing from the cache.
     *
     * Held against the manifest rather than against zero. A request for a file
     * that *is* precached and was aborted anyway is noise from the cut itself —
     * a font or a lazy chunk the previous document had already asked for over
     * the network, arriving as a cancellation the moment the route goes in.
     * Firefox produces a handful of those on a loaded machine and Chromium
     * none, and neither says anything about the precache. A request for a file
     * that is *not* in the manifest is the failure this is looking for: the
     * hymnal's Optima, in the shape it had before it was noticed.
     */
    const shellEscapes = [
        ...new Set(
            escaped
                .filter((url) => url.startsWith(previewUrl))
                .map((url) => new URL(url).pathname.replace(/^\//, ''))
                .filter((path) => !PRECACHED.has(path)),
        ),
    ];
    expect(shellEscapes, 'a shell file was not in the precache').toEqual([]);
});

test('hands over every file it promised, with the network gone', async ({ browserName }) => {
    test.skip(
        browserName === 'webkit',
        'Playwright WebKit will not let a worker answer a navigation',
    );
    test.setTimeout(300_000);

    /*
     * The walk above proves the paths it happens to take. This asks for the
     * whole manifest.
     *
     * Every entry, fetched from inside the offline page: the 2.7 MB soundfonts
     * that only a first press of play would otherwise pull, the notation
     * library, every font subset, every icon. The network is still aborted from
     * the previous test — same context, same route — so anything that is not
     * genuinely in the cache cannot quietly arrive from the preview server.
     *
     * This is the difference between "the pages I looked at worked" and "the
     * app is complete on this device".
     */
    const failures = await page.evaluate(
        async (urls: string[]) => {
            const out: string[] = [];
            for (const url of urls) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) out.push(`${url} -> ${response.status}`);
                    // Reading the body catches a cache entry that resolves but
                    // carries nothing, which is how an evicted blob presents.
                    else if ((await response.blob()).size === 0) out.push(`${url} -> empty`);
                } catch (err) {
                    out.push(`${url} -> ${String(err)}`);
                }
            }
            return out;
        },
        [...PRECACHED],
    );

    expect(failures, 'the precache could not produce a file it holds').toEqual([]);
    console.log(`  ✓ all ${PRECACHED.size} precached files served offline`);
});
