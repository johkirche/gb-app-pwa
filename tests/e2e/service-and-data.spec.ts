import { type Page, expect, test } from '@playwright/test';

import { NO_RECORDING, RECORDING, hasRecording } from './support/backend';
import { type LibraryFixture, nav, openLibrary, openTab } from './support/library';

/*
 * The last views that had never been opened: the Gottesdienst tab, the download
 * page and the install page.
 *
 * Gottesdienst is the interesting one. It is an occasion rather than a fixture:
 * the tab appears for as long as hymns are marked for one, so the test has to
 * make the occasion before it can visit it — which is also the only way to find
 * out whether marking a hymn actually raises the tab.
 */

test.skip(!RECORDING && !hasRecording, NO_RECORDING);
test.describe.configure({ mode: 'serial' });

let lib: LibraryFixture;
let page: Page;

test.beforeAll(async ({ browserName, baseURL }) => {
    test.setTimeout(240_000);
    lib = await openLibrary(browserName, baseURL!);
    page = lib.page;
});

test.afterAll(async () => {
    await lib?.close();
});

test('with nothing marked, the Gottesdienst tab is not offered', async () => {
    await openTab(page, 'Lieder');
    await expect(nav(page).getByRole('link', { name: 'Gottesdienst' })).toHaveCount(0);

    // The route still resolves, so a link to it never dead-ends.
    await page.goto('/tabs/gottesdienst');
    await expect(page.getByText('Nichts vorgemerkt')).toBeVisible({ timeout: 15_000 });
});

test('marking a hymn raises the tab and fills the page', async () => {
    await openTab(page, 'Lieder');
    await page.locator('.song-row button').first().click();
    await page.waitForURL(/\/(songs|lied)\//, { timeout: 30_000 });

    await page.getByRole('button', { name: 'Einstellungen' }).first().click();
    await page.getByText('Für Gottesdienst vormerken').click();
    // The toast is the app saying the plan was written, not just that a button
    // was pressed — and the tab below only appears once it has been.
    await expect(page.getByText('Für den Gottesdienst vorgemerkt')).toBeVisible({
        timeout: 15_000,
    });
    await page.waitForTimeout(500);

    // The tab is an occasion: it appears because something is marked for it.
    await openTab(page, 'Lieder');
    await expect(nav(page).getByRole('link', { name: 'Gottesdienst' })).toBeVisible({
        timeout: 15_000,
    });

    await openTab(page, 'Gottesdienst');
    await expect(page.getByText('Nichts vorgemerkt')).toBeHidden();
    expect(await page.locator('main li').count(), 'the service plan is empty').toBeGreaterThan(0);
});

test('the marked hymn can be taken off again', async () => {
    await openTab(page, 'Gottesdienst');
    await page.locator('main li button').first().click();
    await page.waitForURL(/\/(songs|lied)\//, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Einstellungen' }).first().click();
    await page.getByText('Aus Gottesdienst entfernen').click();
    await expect(page.getByText('Aus dem Gottesdienst entfernt')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);

    await page.goto('/tabs/gottesdienst');
    await expect(page.getByText('Nichts vorgemerkt')).toBeVisible({ timeout: 15_000 });
});

test('the download page reports what is on the device', async () => {
    await page.goto('/download');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    // It counts the library rather than guessing at it.
    const text = (await main.innerText()).replace(/\s+/g, ' ');
    expect(text, 'the page names no song count').toMatch(/\d+\s*Lieder/);

    // With a full library there is nothing left to fetch, so the page offers a
    // delta rather than quoting the whole book.
    await expect(page.getByText(/Es werden nur die Änderungen geladen/)).toBeVisible();
});

test('the install page renders', async () => {
    await page.goto('/install-pwa');
    // Two headings carry that name: the page's own and the step's inside it.
    await expect(page.getByRole('heading', { name: 'App installieren' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Weiter|Fertig/ }).first()).toBeVisible();
});
