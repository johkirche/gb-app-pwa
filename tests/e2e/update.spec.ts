import type { BrowserContext, Page } from '@playwright/test';
import { chromium, expect, firefox, test, webkit } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type Preview, servePreview } from './support/preview';

/*
 * „Eine neue Version des Gesangbuchs ist verfügbar."
 *
 * The one path in the app that only exists on the *second* deploy, and so the
 * one nothing had ever run. It is also the path with the most ways to go wrong
 * quietly: a worker that took over on its own would reload a hymnal mid-service
 * (which is why registerType is 'prompt' and not 'autoUpdate'), and a worker
 * that never takes over leaves readers on a version that no amount of reloading
 * replaces — the update is *waiting*, and waiting is not a state anyone sees.
 *
 * So this serves a built dist/ out of a copy it owns, lets the worker install,
 * edits sw.js underneath it the way a deploy would, and watches what the app
 * does about it.
 *
 * No backend and no recording: the worker registers on mount (main.ts), and
 * the toast comes from the <Toaster /> in App.vue, so the login page is enough.
 * It needs `pnpm build` and skips with a message if there is none.
 */

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

const hasBuild = existsSync(join(DIST, 'sw.js'));
const NO_BUILD =
    'No production build in dist/ — run `pnpm build` once, then `pnpm test:e2e` ' +
    'to include the update check.';

test.skip(!hasBuild, NO_BUILD);
test.describe.configure({ mode: 'serial' });

const ENGINES = { chromium, firefox, webkit };

let served: string;
let preview: Preview;
let context: BrowserContext;
let page: Page;
let profile: string | undefined;
let closeBrowser: (() => Promise<void>) | undefined;

/**
 * Ship a version.
 *
 * A deploy reaches the browser as one thing: the bytes of sw.js differ from the
 * ones it has. That is the whole trigger — the browser refetches the script on
 * navigation and on registration.update(), byte-compares, and installs a new
 * worker if it moved. So a version here is a marker appended to sw.js.
 *
 * The marker answers to a message, which is what makes "did the new worker
 * actually take over?" a question with an answer rather than an inference: the
 * page asks whoever is controlling it which version it is, and is told.
 *
 * What this deliberately does not do is change the precache manifest. A real
 * deploy would, and the new worker would download the changed assets during
 * install — but that is the precache path, which offline.spec.ts covers. What
 * is under test here is the worker lifecycle above it.
 */
function deploy(version: string) {
    const swPath = join(served, 'sw.js');
    const source = readFileSync(swPath, 'utf8').replace(/\n\/\/ e2e-deploy[\s\S]*$/, '');

    writeFileSync(
        swPath,
        `${source}\n// e2e-deploy ${version}\n` +
            `self.addEventListener('message',e=>{` +
            `if(e.data&&e.data.type==='E2E_VERSION'&&e.ports&&e.ports[0])` +
            `e.ports[0].postMessage(${JSON.stringify(version)})});\n`,
    );
}

/** Ask whoever is controlling this page which version it is. */
async function controllingVersion(target: Page): Promise<string | null> {
    return target.evaluate(
        () =>
            new Promise<string | null>((resolve) => {
                const worker = navigator.serviceWorker.controller;
                if (!worker) return resolve(null);

                const channel = new MessageChannel();
                const timer = setTimeout(() => resolve('no answer'), 5_000);
                channel.port1.onmessage = (event: MessageEvent) => {
                    clearTimeout(timer);
                    resolve(event.data as string);
                };
                worker.postMessage({ type: 'E2E_VERSION' }, [channel.port2]);
            }),
    );
}

/** Whether a worker is parked, installed but not yet in charge. */
async function hasWaitingWorker(target: Page): Promise<boolean> {
    return target.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.waiting != null;
    });
}

/** What a deploy looks like from the browser's side: refetch, byte-compare. */
async function checkForUpdate(target: Page): Promise<void> {
    await target.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
    });
}

test.beforeAll(async ({ browserName }) => {
    test.setTimeout(180_000);

    // A copy, because this spec rewrites what it serves and dist/ is shared
    // with offline.spec.ts running in parallel.
    served = mkdtempSync(join(tmpdir(), 'gb-e2e-deploy-'));
    cpSync(DIST, served, { recursive: true });
    deploy('v1');

    preview = await servePreview(served);

    const engine = ENGINES[browserName];
    if (browserName === 'webkit') {
        profile = mkdtempSync(join(tmpdir(), 'gb-e2e-update-'));
        context = await engine.launchPersistentContext(profile, { baseURL: preview.url });
    } else {
        const browser = await engine.launch();
        closeBrowser = () => browser.close();
        context = await browser.newContext({ baseURL: preview.url });
    }

    page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
    await context?.close();
    await closeBrowser?.();
    await preview?.close();
    if (profile) rmSync(profile, { recursive: true, force: true });
    if (served) rmSync(served, { recursive: true, force: true });
});

test('installs v1 and takes charge of the page', async () => {
    test.setTimeout(120_000);

    await page.goto('/');
    await expect
        .poll(
            () =>
                page.evaluate(async () => {
                    const registration = await navigator.serviceWorker.getRegistration();
                    return registration?.active != null;
                }),
            { timeout: 60_000 },
        )
        .toBe(true);

    /*
     * The reload is the point, not a warm-up.
     *
     * 'prompt' mode leaves out clientsClaim on purpose, so the page that
     * registered the worker is never controlled by it. And an *uncontrolled*
     * page is exactly the case where the next worker would activate straight
     * away instead of parking — no waiting worker, no toast, and a test that
     * passed by never reaching the thing it was written for.
     */
    await page.reload();
    await expect
        .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
            timeout: 60_000,
        })
        .toBe(true);

    expect(await controllingVersion(page), 'v1 is not the worker in charge').toBe('v1');
});

test('offers the update instead of taking it, and takes it when asked', async () => {
    test.setTimeout(120_000);

    deploy('v2');
    await checkForUpdate(page);

    // Offered, not taken: the new worker parks, and the reader is asked.
    const toast = page.getByText('Eine neue Version des Gesangbuchs ist verfügbar.');
    await expect(toast).toBeVisible({ timeout: 30_000 });
    expect(await hasWaitingWorker(page), 'nothing is waiting to take over').toBe(true);

    // Still v1 on screen. An app that had swapped itself out from under the
    // reader would already be answering v2 here.
    expect(await controllingVersion(page), 'the update was taken without asking').toBe('v1');

    /*
     * updateSW posts SKIP_WAITING; the worker activates, claims the page, and
     * workbox-window's 'controlling' handler reloads it.
     *
     * Armed before the click and awaited after, rather than polled for: a poll
     * that evaluates in the page races the very navigation it is watching for,
     * and loses with "Execution context was destroyed" about half the time.
     * 'load' fires again on the new document and cannot be missed this way.
     */
    const reloaded = page.waitForEvent('load', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Aktualisieren' }).click();
    await reloaded;

    await expect.poll(() => controllingVersion(page), { timeout: 60_000 }).toBe('v2');
    expect(await hasWaitingWorker(page), 'a worker is still parked after updating').toBe(false);
});

test('leaves the update parked when the reader says Später', async () => {
    test.setTimeout(120_000);

    deploy('v3');
    await checkForUpdate(page);

    await expect(page.getByText('Eine neue Version des Gesangbuchs ist verfügbar.')).toBeVisible({
        timeout: 60_000,
    });

    // A sentinel that only survives if the page is never reloaded.
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).stillHere = true));
    await page.getByRole('button', { name: 'Später' }).click();

    // Dismissed, and nothing else: no reload, and the page on screen stays put.
    await expect(page.getByText('Eine neue Version des Gesangbuchs ist verfügbar.')).toBeHidden({
        timeout: 30_000,
    });
    // Long enough that a reload on its way would have happened by now.
    await page.waitForTimeout(1_000);
    expect(
        await page
            .evaluate(() => (window as unknown as Record<string, unknown>).stillHere === true)
            // A destroyed context *is* the failure this is looking for.
            .catch(() => false),
        'Später reloaded the page',
    ).toBe(true);
    expect(await controllingVersion(page), 'Später took the update anyway').toBe('v2');

    // But it is not thrown away either — it stays parked, and activates by
    // itself once every tab of the app has been closed.
    expect(await hasWaitingWorker(page), 'the update was discarded rather than parked').toBe(true);
});

/*
 * What a Pixel was found holding on 2026-11-18: the worker's index.html from
 * the build before, filed under the new build's revision, because the deploy
 * was still spreading when the worker asked for it. That page names scripts the
 * server no longer has, the server answers them with the app's own page as
 * text/html, and no browser runs that as a module. Black, in the browser and
 * the installed app alike, and the app could not look for an update either: the
 * app is the script that did not load.
 *
 * Made here the way it happened. The cached page is rewritten in place to name
 * a script that does not exist, and the next visit is answered from the cache.
 * The guard in index.html has to bring the app up without anyone touching it.
 */
test('a cached page whose script is gone puts itself right in one reload', async ({
    browserName,
}) => {
    test.skip(
        browserName === 'webkit',
        "Playwright's WebKit will not let a worker answer a navigation, so the cached page never comes back to break anything.",
    );
    test.setTimeout(120_000);

    const poisoned = await page.evaluate(async () => {
        let count = 0;
        for (const name of await caches.keys()) {
            if (!name.startsWith('workbox-precache')) continue;
            const cache = await caches.open(name);
            for (const request of await cache.keys()) {
                if (!new URL(request.url).pathname.endsWith('/index.html')) continue;
                const response = await cache.match(request);
                if (!response) continue;
                const html = (await response.text()).replace(
                    /\/assets\/index-[\w-]+\.js/,
                    '/assets/index-weg.js',
                );
                await cache.put(request, new Response(html, { headers: response.headers }));
                count++;
            }
        }
        return count;
    });
    expect(poisoned, 'the worker holds no index.html to spoil').toBe(1);

    // Two loads: the spoiled page, and the one the guard reloads into.
    let loads = 0;
    const countLoad = () => loads++;
    page.on('load', countLoad);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Gesangbuch', exact: true })).toBeVisible({
        timeout: 30_000,
    });
    page.off('load', countLoad);
    expect(loads, 'the cached page never broke, so nothing was put right').toBe(2);

    // Up, so the mark is gone and a later spoiled page would be put right too.
    expect(await page.evaluate(() => sessionStorage.getItem('gesangbuch.neuGeladen'))).toBeNull();

    // And the worker the app registered afresh has cached the page that works.
    await expect
        .poll(
            () =>
                page.evaluate(async () => {
                    for (const name of await caches.keys()) {
                        if (!name.startsWith('workbox-precache')) continue;
                        const cache = await caches.open(name);
                        for (const request of await cache.keys()) {
                            if (!new URL(request.url).pathname.endsWith('/index.html')) continue;
                            const html = await (await cache.match(request))?.text();
                            return html?.includes('/assets/index-weg.js') ? 'spoiled' : 'fresh';
                        }
                    }
                    return 'none';
                }),
            { timeout: 60_000 },
        )
        .toBe('fresh');
});
