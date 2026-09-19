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
 * Recording it is the same walk against the real Directus:
 *   pnpm test:e2e:record
 */

test.skip(!RECORDING && !hasRecording, NO_RECORDING);

const email = process.env.E2E_DIRECTUS_EMAIL;
const password = process.env.E2E_DIRECTUS_PASSWORD;

/** Replay stubs the login, so only the recording run needs a real account. */
const CREDENTIALS = RECORDING
    ? { email: email ?? '', password: password ?? '' }
    : { email: 'e2e@example.invalid', password: 'e2e-password' };

test.beforeAll(() => {
    if (RECORDING && (!email || !password)) {
        throw new Error(
            'Recording needs a real Directus account. Add E2E_DIRECTUS_EMAIL and ' +
                'E2E_DIRECTUS_PASSWORD to .env (no VITE_ prefix — see .env.example).',
        );
    }
});

test('logs in and downloads the Gesangbuch', async ({ page }) => {
    // The real thing against the real backend takes longer than a default.
    test.setTimeout(RECORDING ? 300_000 : 120_000);

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
    // required for. Let it run to the end, however long the book takes.
    await expect(page).toHaveURL(/\/(onboarding|tabs)/, { timeout: 60_000 });

    const nav = page.locator('nav[aria-label="Hauptnavigation"]:visible');
    await expect(nav).toBeVisible({ timeout: RECORDING ? 240_000 : 90_000 });

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
    expect(stored, 'no songs reached IndexedDB').toBeGreaterThan(0);

    // And the reader can see them.
    await nav.getByRole('link', { name: 'Lieder' }).click();
    await expect(page.getByText('Keine Lieder vorhanden')).toBeHidden();
});
