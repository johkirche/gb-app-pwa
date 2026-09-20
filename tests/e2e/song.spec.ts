import { type Page, expect, test } from '@playwright/test';

import { NO_RECORDING, RECORDING, hasRecording } from './support/backend';
import { type LibraryFixture, nav, openLibrary, openTab } from './support/library';

/*
 * The hymn itself — the view a reader actually spends the service in, and the
 * one nothing had ever opened.
 *
 * The library is synced once for the file and shared: these are reads, and
 * paying five seconds a test to watch the same sync again would buy nothing
 * that sync.spec.ts does not already assert.
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

/** Open the first hymn in the list; returns the number and title the row showed. */
async function openFirstSong(): Promise<{ number: string; title: string }> {
    // Straight to the list rather than via the tab bar: a hymn page is a
    // top-level route and carries no tab bar to click, so a test that opened
    // one already has nowhere to press.
    await page.goto('/tabs/lieder');
    const row = page.locator('.song-row button').first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    // The row reads as number, then title, then the melody line beneath it.
    const lines = ((await row.innerText()) || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const number = (lines.find((line) => /^\d+$/.test(line)) ?? '').trim();
    const title =
        lines.filter((line) => !/^\d+$/.test(line)).sort((a, b) => b.length - a.length)[0] ?? '';

    await row.click();
    await page.waitForURL(/\/(songs|lied)\//, { timeout: 30_000 });
    return { number, title };
}

test('the list holds the whole book', async () => {
    await openTab(page, 'Lieder');
    await expect(page.getByText('Keine Lieder vorhanden')).toBeHidden();
    const rows = page.locator('.song-row');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    // 565 hymns were recorded; the list is virtualised by nothing, so they are
    // all in the document.
    expect(await rows.count()).toBeGreaterThan(400);
});

test('search narrows the list and clears again', async () => {
    await openTab(page, 'Lieder');
    const before = await page.locator('.song-row').count();

    await page
        .getByRole('button', { name: 'Suchen', exact: true })
        .click()
        .catch(() => {});
    const field = page.getByPlaceholder('Suchen...');
    await expect(field).toBeVisible();
    await field.fill('Gott');
    await page.waitForTimeout(600);

    const during = await page.locator('.song-row').count();
    expect(during, 'search found nothing').toBeGreaterThan(0);
    expect(during, 'search narrowed nothing').toBeLessThan(before);

    await page.getByRole('button', { name: 'Suche löschen' }).click();
    await page.waitForTimeout(600);
    expect(await page.locator('.song-row').count()).toBe(before);
});

test('a remembered line finds the hymn, and the row says where', async () => {
    // The line is taken out of the recorded book rather than invented here:
    // nothing in this file knows which hymns were recorded, and a phrase made
    // up for the test would only assert that the search finds nothing.
    await openFirstSong();
    const verses = page.locator('main .verse-text');
    await expect(verses.first()).toBeVisible({ timeout: 30_000 });
    const verse = ((await verses.last().innerText()) || '').replace(/\s+/g, ' ').trim();
    // Out of the middle of the last verse, so it is nowhere near a title.
    const phrase = verse.split(' ').slice(2, 6).join(' ');
    expect(phrase.length, 'the hymn carried no verse to search in').toBeGreaterThan(8);

    await page.goto('/tabs/lieder');
    await page
        .getByRole('button', { name: 'Suchen', exact: true })
        .click()
        .catch(() => {});
    const field = page.getByPlaceholder('Suchen...');
    await expect(field).toBeVisible();
    await field.fill(phrase);
    await page.waitForTimeout(600);

    // Nothing had to be switched on first: the verses are in the search.
    const rows = page.locator('.song-row');
    expect(await rows.count(), `the line was not found: ${phrase}`).toBeGreaterThan(0);

    // And the row shows the line it found, not the opening of the verse it
    // happens to sit in — the snippet is cut around where the words stand
    // together.
    const snippet = (await rows.first().innerText()).replace(/\s+/g, ' ');
    expect(snippet, 'the row does not show the line it matched').toContain(phrase);

    // Narrowing to the title takes it away again, and offers it back.
    await page.getByRole('button', { name: 'Suchoptionen' }).click();
    await page.getByRole('button', { name: 'Nur in Titeln und Nummern suchen' }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(await rows.count(), 'a title held the interior line').toBe(0);
    await expect(page.getByRole('button', { name: /im Liedtext$/ })).toBeVisible();

    // Back to searching the verses, and now on two words only — which half the
    // book holds somewhere. The list is ordered by the longest run the words
    // cover uninterrupted, so whatever stands first must hold them side by
    // side; a hymn that merely has both, pages apart, cannot outrank that.
    await page.getByRole('button', { name: 'Suchoptionen' }).click();
    await page.getByRole('button', { name: 'Auch in den Strophen suchen' }).click();
    await page.keyboard.press('Escape');
    const pair = verse.split(' ').slice(2, 4).join(' ');
    await field.fill(pair);
    await page.waitForTimeout(600);

    expect(await rows.count(), `nothing found for: ${pair}`).toBeGreaterThan(0);
    const top = (await rows.first().innerText()).replace(/\s+/g, ' ').toLowerCase();
    expect(top, 'the best match is not at the top').toContain(pair.toLowerCase());

    // Put the list back the way the next test expects to find it.
    await page.getByRole('button', { name: 'Suche löschen' }).click();
    await page.waitForTimeout(600);
});

test('a hymn opens, and it is the one that was tapped', async () => {
    const { number, title } = await openFirstSong();
    expect(number, 'the row showed no hymn number').not.toBe('');
    expect(title.length, 'the row showed no title').toBeGreaterThan(4);

    // The list navigates by record id; /lied/<nummer> is the shareable address.
    expect(page.url()).toMatch(/\/songs\/\w+/);

    // The hymn that opened is the hymn that was tapped.
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();

    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    const text = (await main.innerText()).replace(/\s+/g, ' ').trim();
    expect(text.length, 'the hymn page rendered no text').toBeGreaterThan(80);
});

test('the engraving is fetched on demand and drawn', async () => {
    await openFirstSong();

    // The Notenbild is inlined rather than shown through <img>, so the
    // engraving can take the theme's ink — see utils/notationSvg.ts. It
    // announces itself as an image either way.
    const notenbild = page.getByRole('img', { name: 'Notenbild' }).first();
    await expect(notenbild).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Notenbild wird geladen...')).toBeHidden();

    // The file was never part of the sync's own download for this page — it is
    // fetched on demand — so this also proves the recorded asset came back and
    // was drawn: an engraving is hundreds of paths, an icon is a handful.
    // An engraving is tens to hundreds of glyph outlines; a UI icon is under
    // ten. The shortest hymns draw around 80, so the floor sits below that.
    const paths = await page.locator('.noten-svg svg path').count();
    expect(paths, 'the engraving drew no glyphs').toBeGreaterThan(40);
});

test('a hymn can be favourited and shows up in Favoriten', async () => {
    const { title } = await openFirstSong();

    const add = page.getByRole('button', { name: 'Zu Favoriten hinzufügen' });
    await expect(add).toBeVisible();
    await add.click();
    await expect(page.getByRole('button', { name: 'Aus Favoriten entfernen' })).toBeVisible();

    // Favoriten keeps its own list markup, not the song list's rows.
    await page.goto('/favorites');
    const rows = page.locator('main ul > li');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Keine Favoriten')).toBeHidden();
    expect(await rows.count(), 'exactly the one favourited hymn').toBe(1);
    await expect(rows.first()).toContainText(title);

    // Put it back, so the shared library is as the next test expects it.
    await rows.first().locator('button').first().click();
    await page.waitForURL(/\/(songs|lied)\//);
    await page.getByRole('button', { name: 'Aus Favoriten entfernen' }).click();
    await expect(page.getByRole('button', { name: 'Zu Favoriten hinzufügen' })).toBeVisible();

    await page.goto('/favorites');
    await expect(page.getByText('Keine Favoriten')).toBeVisible();
});

test('the tab bar survives the hymn page', async () => {
    await openFirstSong();
    // A song is opened from a tab and must come back to one.
    await page.goBack();
    await expect(nav(page)).toBeVisible();
});
