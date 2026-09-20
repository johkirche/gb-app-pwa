import { type Page, expect, test } from '@playwright/test';

import { NO_RECORDING, RECORDING, hasRecording } from './support/backend';
import { type LibraryFixture, openLibrary, openTab } from './support/library';

/*
 * A playlist, end to end: make one, put hymns in it, see them, take it away.
 *
 * Three views that only ever existed as routes — CreatePlaylistPage,
 * AddSongsToPlaylistPage and PlaylistDetailPage — and one flow that crosses all
 * of them. Serial, because each step is the next one's setup.
 */

test.skip(!RECORDING && !hasRecording, NO_RECORDING);
test.describe.configure({ mode: 'serial' });

const NAME = 'Gottesdienst-Test';

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

test('the tab starts with Favoriten and no playlists', async () => {
    await openTab(page, 'Playlisten');
    await expect(page.getByText('Keine Playlisten')).toBeVisible();
    // Favoriten is always offered, playlist or not. Scoped to <main>: the
    // hidden desktop sidebar carries a Favoriten link of its own.
    await expect(page.locator('main').getByText('Favoriten').first()).toBeVisible();
});

test('a playlist can be created', async () => {
    await openTab(page, 'Playlisten');
    await page.getByRole('button', { name: 'Playlist erstellen' }).first().click();
    await expect(page).toHaveURL(/\/playlists\/create/);

    await page.getByPlaceholder('z.B. Sonntagsgottesdienst').fill(NAME);
    await page.getByRole('button', { name: 'Playlist erstellen' }).last().click();

    // It lands somewhere that knows the playlist — its detail page or the list.
    await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Keine Playlisten')).toBeHidden();
});

test('hymns can be added to it', async () => {
    await openTab(page, 'Playlisten');
    await page.locator('main').getByText(NAME).first().click();
    await expect(page).toHaveURL(/\/playlists\/[^/]+$/);

    await page.getByRole('button', { name: 'Lieder hinzufügen' }).first().click();
    await expect(page).toHaveURL(/\/add-songs/);

    // Narrow the book down, then take the first two that match.
    await page.getByPlaceholder('Lieder suchen...').fill('Gott');
    await page.waitForTimeout(700);

    const rows = page.locator('main button, main li');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    const checks = page.getByRole('checkbox');
    const count = Math.min(2, await checks.count());
    expect(count, 'nothing selectable on the add-songs page').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await checks.nth(i).click();

    await page
        .getByRole('button', { name: /hinzufügen/i })
        .last()
        .click();
    await expect(page).toHaveURL(/\/playlists\/[^/]+$/, { timeout: 15_000 });
});

test('the playlist shows what was put in it', async () => {
    await openTab(page, 'Playlisten');
    await page.locator('main').getByText(NAME).first().click();
    await expect(page).toHaveURL(/\/playlists\/[^/]+$/);

    await expect(page.getByText(NAME).first()).toBeVisible();
    const entries = page.locator('main li');
    await expect(entries.first()).toBeVisible({ timeout: 15_000 });
    expect(await entries.count(), 'the playlist came back empty').toBeGreaterThan(0);
});

test('a hymn in it opens', async () => {
    await openTab(page, 'Playlisten');
    await page.locator('main').getByText(NAME).first().click();
    await page.locator('main li button').first().click();
    await page.waitForURL(/\/(songs|lied)\//, { timeout: 15_000 });
    await expect(page.getByRole('img', { name: 'Notenbild' }).first()).toBeVisible({
        timeout: 30_000,
    });
});
