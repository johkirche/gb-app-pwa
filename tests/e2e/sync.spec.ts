import type { Page } from '@playwright/test';

import { NO_RECORDING, RECORDING, expect, hasRecording, test } from './support/backend';

/*
 * The sync, end to end — and the run that records the fixtures every other
 * spec replays.
 *
 * src/api/ is 516 lines of manifest, delta and token-refresh logic that no
 * test has ever executed: syncDiff.ts has unit tests for the arithmetic of a
 * delta, but nothing has watched a real manifest become a real download become
 * rows in IndexedDB. That is what this walks.
 *
 * Onboarding is a two-step wizard, not an automatic run: the Install step waits
 * for „Weiter", and only then does the download start on its own and offer
 * „Fertig" at the end. The whole book is about 90 MB, so the recording run is
 * measured in minutes and prints what it is doing while it works.
 *
 *   pnpm test:e2e:record
 */

test.skip(!RECORDING && !hasRecording, NO_RECORDING);

/*
 * Not on WebKit, and not for want of trying.
 *
 * The sync stores each notation file as a Blob in IndexedDB, and WebKit in an
 * ephemeral browser context cannot store a Blob there at all — measured: a
 * five-byte one aborts the transaction with no error object, while an
 * ArrayBuffer or a string of a megabyte goes in fine. The download loop treats
 * the first storage failure as a full disk and marks every remaining file
 * failed, which is why this surfaced as all 1121 files failing at once with
 * nothing wrong on the network.
 *
 * Real Safari, with persistent storage, stores Blobs perfectly well, so this is
 * the test environment's limit rather than the app's. What the spec covers —
 * manifest, delta, token refresh, IndexedDB rows — is engine-independent, and
 * the readability walk still runs on all three.
 */
test.skip(
    ({ browserName }) => browserName === 'webkit',
    'WebKit cannot store Blobs in IndexedDB in an ephemeral context',
);

const email = process.env.E2E_DIRECTUS_EMAIL;
const password = process.env.E2E_DIRECTUS_PASSWORD;

/** Replay stubs the login, so only the recording run needs a real account. */
const CREDENTIALS = RECORDING
    ? { email: email ?? '', password: password ?? '' }
    : { email: 'e2e@example.invalid', password: 'e2e-password' };

/** Downloading ~90 MB over a real connection, versus reading it off disk. */
const DOWNLOAD_BUDGET = RECORDING ? 30 * 60_000 : 5 * 60_000;

test.beforeAll(() => {
    if (RECORDING && (!email || !password)) {
        throw new Error(
            'Recording needs a real Directus account. Add E2E_DIRECTUS_EMAIL and ' +
                'E2E_DIRECTUS_PASSWORD to .env (no VITE_ prefix — see .env.example).',
        );
    }
});

/**
 * Sit out the download, saying where it has got to.
 *
 * A bare `expect(…).toBeVisible({ timeout: 30min })` would be a half-hour of
 * silence ending in "element(s) not found", which says nothing about whether
 * the thing was working. This prints each change of phase, and fails the moment
 * the page offers a retry instead of waiting for a completion that is not
 * coming.
 */
async function waitForDownload(page: Page, budgetMs: number) {
    const done = page.getByRole('button', { name: 'Fertig' });
    const progress = page.getByText(/von \d+ Dateien|Lieder werden geladen|Daten werden geladen/);
    const failed = page.getByText(/konnten nicht heruntergeladen werden/);
    const retry = page.getByRole('button', { name: 'Erneut versuchen' });

    const deadline = Date.now() + budgetMs;
    let last = '';

    while (Date.now() < deadline) {
        if (await done.isVisible().catch(() => false)) {
            console.log('  ✓ download complete');
            return;
        }
        if (await failed.isVisible().catch(() => false)) {
            throw new Error(`Download reported failures: ${await failed.innerText()}`);
        }
        if ((await retry.isVisible().catch(() => false)) && !(await progress.count())) {
            throw new Error('Download failed and is offering a retry — see the screenshot.');
        }

        const text = await progress
            .first()
            .innerText()
            .catch(() => '');
        if (text && text !== last) {
            console.log(`  … ${text}`);
            last = text;
        }
        await page.waitForTimeout(2_000);
    }

    throw new Error(`Download did not finish within ${Math.round(budgetMs / 60_000)} minutes.`);
}

test('logs in and downloads the Gesangbuch', async ({ page }) => {
    test.setTimeout(DOWNLOAD_BUDGET + 120_000);

    await page.goto('/login');
    await page
        .getByLabel(/E-Mail/i)
        .first()
        .fill(CREDENTIALS.email);
    await page
        .getByLabel(/Passwort/i)
        .first()
        .fill(CREDENTIALS.password);
    await page.getByRole('button', { name: 'Anmelden' }).click();

    // Onboarding *is* the download: the one view a session is genuinely
    // required for.
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 60_000 });

    // Step 1 of 2 — the PWA install prompt, which only moves on when asked to.
    await page.getByRole('button', { name: 'Weiter' }).click();

    // Step 2 of 2 — starts by itself once the step is active.
    await expect(page.getByRole('heading', { name: 'Inhalte herunterladen' })).toBeVisible();
    await waitForDownload(page, DOWNLOAD_BUDGET);

    await page.getByRole('button', { name: 'Fertig' }).click();

    const nav = page.locator('nav[aria-label="Hauptnavigation"]:visible');
    await expect(nav).toBeVisible({ timeout: 60_000 });

    // The book is on the device: rows in IndexedDB, not just a screen that
    // stopped spinning.
    const stored = await page.evaluate(
        () =>
            new Promise<number>((resolve, reject) => {
                const open = indexedDB.open('GesangbuchDB');
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                    const db = open.result;
                    const count = db.transaction('songs').objectStore('songs').count();
                    count.onsuccess = () => resolve(count.result);
                    count.onerror = () => reject(count.error);
                };
            }),
    );
    console.log(`  ✓ ${stored} songs in IndexedDB`);
    expect(stored, 'no songs reached IndexedDB').toBeGreaterThan(0);

    // And the reader can see them.
    await nav.getByRole('link', { name: 'Lieder' }).click();
    await expect(page.getByText('Keine Lieder vorhanden')).toBeHidden();
});
