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

/*
 * Issue #31 — the Tonhöhe control.
 *
 * Two halves, and the second is the point: the offset has to reach the
 * playback and must not reach the page. The engraving is the book's, in the
 * book's key, and it is counted here before and after to say so.
 *
 * It is also off until it is asked for, so the walk starts by proving the
 * transport carries no such button, and puts the switch back at the end —
 * the library is shared with whatever runs next.
 */
test('the Tonhöhe control moves the playback and leaves the engraving alone', async () => {
    await openFirstSong();
    await expect(page.getByRole('button', { name: 'Wiedergabe' })).toBeVisible({
        timeout: 30_000,
    });
    // Off, the settings button at the end of the bar is the Tempo and nothing
    // else — no fifth control, and no mention of a key.
    await expect(page.getByRole('button', { name: /^Tempo: / })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Wiedergabe: / })).toHaveCount(0);

    // Asked for where it is offered, and nowhere else.
    await page.goto('/tabs/einstellungen?bereich=wiedergabe');
    const schalter = page.locator('#settings-pitch-control');
    await expect(schalter).toBeVisible({ timeout: 15_000 });
    await schalter.click();
    await expect(schalter).toHaveAttribute('data-state', 'checked');
    // The switch is written to IndexedDB, and navigating in the same breath
    // aborts the write mid-transaction — the flipped switch would then be the
    // only thing that ever knew about it.
    await page.waitForTimeout(500);

    await openFirstSong();
    // On, the same button carries both — one settings end to the bar, not two.
    const wiedergabe = page.getByRole('button', { name: /^Wiedergabe: / });
    await expect(wiedergabe).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^Tempo: / })).toHaveCount(0);
    // It opens on the hymn as printed — the button names that key and says so.
    const notiert = (await wiedergabe.getAttribute('aria-label')) ?? '';
    expect(notiert, 'the control did not open on the printed key').toMatch(/Wie notiert$/);
    // In the bar it still reads as the tempo: there is no key worth naming
    // while the hymn is in the one it is printed in.
    await expect(wiedergabe).toContainText(/Langsam|Normal|Schnell|BPM/);

    const glyphs = await page.locator('.noten-svg svg path').count();
    expect(glyphs, 'no engraving to hold still').toBeGreaterThan(40);

    // Größe reaches the transport too: the bar gives up the word on the
    // settings button before it gives up the side of the phone. This is the one
    // place the readability walk cannot reach — it has no library behind it,
    // and without one there is no hymn and no transport.
    for (const scale of ['0.5', '2']) {
        await page.evaluate(
            (value) => document.documentElement.style.setProperty('--page-scale', value),
            scale,
        );
        await page.waitForTimeout(300);
        const sideways = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(sideways, `the transport leaves the phone at ${scale}×`).toBeLessThanOrEqual(1);
    }
    await page.evaluate(() => document.documentElement.style.removeProperty('--page-scale'));
    await page.waitForTimeout(300);

    await wiedergabe.click();
    // Both settings are in the one panel now, tempo above and Tonhöhe below.
    await expect(
        page.getByText('Genaues Tempo').or(page.getByText('Normal')).first(),
    ).toBeVisible();
    // The panel says which half of the hymn moved, because the page did not —
    // and says it on one line whatever the offset, so the +/− pair does not
    // walk down the panel as the reader steps a half-tone at a time.
    const hinweis = page.getByText(/^(Die Noten|Nur die Wiedergabe|Verschiebt)/);
    await expect(hinweis).toBeVisible();
    const zeile = (await hinweis.boundingBox())?.height ?? 0;
    expect(zeile, 'the panel says nothing about the notes').toBeGreaterThan(0);

    const hoeher = page.getByRole('button', { name: 'Höher spielen' });
    await hoeher.click();
    await hoeher.click();
    await expect(page.getByText('2 Halbtöne höher')).toBeVisible();
    await expect(hinweis).toBeVisible();
    expect((await hinweis.boundingBox())?.height, 'the panel grew a line').toBe(zeile);
    // Closed before the transport is read again: the panel is a modal sheet at
    // this width and hides the page behind it from the accessibility tree.
    await page.keyboard.press('Escape');

    const verschoben = (await wiedergabe.getAttribute('aria-label')) ?? '';
    expect(verschoben, 'the control still reads as the printed hymn').not.toBe(notiert);
    expect(verschoben).toContain('2 Halbtöne höher');
    // Both settings on one button: the word gives way to the key, and the
    // tempo keeps the icon it always had — so a hymn that is faster AND in
    // another key says both without asking the bar for more room.
    await expect(wiedergabe).toContainText(/-(Dur|Moll)$|[+−]\d+$/);
    expect(verschoben, 'the name no longer carries the tempo').toMatch(/Tempo \S+/);

    // And the book is untouched: the same engraving, glyph for glyph.
    expect(await page.locator('.noten-svg svg path').count()).toBe(glyphs);

    await wiedergabe.click();
    await page.getByRole('button', { name: 'Wie notiert spielen' }).click();
    await page.keyboard.press('Escape');
    await expect(wiedergabe).toHaveAttribute('aria-label', notiert);

    // Switched off again, the control leaves the transport with it.
    await page.goto('/tabs/einstellungen?bereich=wiedergabe');
    await schalter.click();
    await expect(schalter).toHaveAttribute('data-state', 'unchecked');
    await page.waitForTimeout(500);
    await openFirstSong();
    await expect(page.getByRole('button', { name: 'Wiedergabe' })).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /^Tempo: / })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Wiedergabe: / })).toHaveCount(0);
});

test('the tab bar survives the hymn page', async () => {
    await openFirstSong();
    // A song is opened from a tab and must come back to one.
    await page.goBack();
    await expect(nav(page)).toBeVisible();
});

/*
 * Issue #24 — what a sitting costs.
 *
 * The reader pages through hymn after hymn, and every one of them used to
 * leave something behind: an audio context built whether or not anyone asked
 * to hear anything, and an object URL holding its engraving in memory with
 * nothing left to revoke it. The end of that arithmetic is a tab that reloads
 * itself mid-service.
 *
 * Both are counted from inside the page rather than read out of a heap
 * snapshot: the wrappers below say exactly which call did it, which a snapshot
 * never does, and they run on all three engines.
 */
test('paging through hymns builds no audio engine and leaves nothing outstanding', async () => {
    // Installed before the next document, so the counters are in place from
    // the first line of app code. It only counts and delegates, so the rest of
    // the file is unaffected by it.
    await page.addInitScript(() => {
        const w = window as unknown as Record<string, unknown>;
        // Documents, not hymns: the whole point of the walk below is that it
        // stays in one, and a reload would silently reset every count here.
        w.__gbDocuments = ((w.__gbDocuments as number) ?? 0) + 1;
        w.__gbContexts = 0;
        const live = new Set<string>();
        w.__gbBlobs = live;

        const mint = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (object: Blob | MediaSource) => {
            const url = mint(object);
            live.add(url);
            return url;
        };
        const release = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = (url: string) => {
            live.delete(url);
            release(url);
        };

        // standardized-audio-context builds the platform's own context
        // underneath, so wrapping the constructor here catches it whichever
        // name this engine keeps it under.
        // Recorded so the assertion below can prove it is watching something.
        // A wrap that silently failed would report zero contexts forever.
        const wrapped: string[] = [];
        w.__gbWrapped = wrapped;
        for (const name of ['AudioContext', 'webkitAudioContext']) {
            const Original = w[name] as (new (...args: never[]) => unknown) | undefined;
            if (typeof Original !== 'function') continue;
            w[name] = new Proxy(Original, {
                construct(target, args, newTarget) {
                    w.__gbContexts = ((w.__gbContexts as number) ?? 0) + 1;
                    return Reflect.construct(target, args as never[], newTarget);
                },
            });
            wrapped.push(name);
        }
    });

    // Ten hymns, each fetching and drawing its engraving, and three engines.
    const HYMNS = 10;
    test.setTimeout(180_000);

    // The only full page load in this test. Everything after it is the app's
    // own routing — a goto() per hymn would be no test at all, since a fresh
    // document takes every object URL and context with it and the count would
    // start from nothing each time.
    await page.goto('/tabs/lieder');
    const rows = page.locator('.song-row');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    // The row's own button, not every button in it: each row also carries an
    // actions menu, which at phone width is present but not clickable.
    const openRow = (index: number) => rows.nth(index).locator('button').first();

    // In and out of ten hymns the way a reader does it: open a row, read, come
    // back to the list. Vor/Zurück on the song page would be the shorter walk,
    // but the bar only appears for a playlist or a service (songPaging
    // defaults to 'lists'), and the plain list is the common case.
    const visited = new Set<string>();
    for (let index = 0; index < HYMNS; index++) {
        await openRow(index).click();
        await page.waitForURL(/\/(songs|lied)\//, { timeout: 30_000 });
        await expect(page.getByRole('img', { name: 'Notenbild' }).first()).toBeVisible({
            timeout: 30_000,
        });
        visited.add(page.url());
        await page.goBack();
        await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    }
    expect(visited.size, 'the walk did not open ten different hymns').toBe(HYMNS);

    const counts = await page.evaluate(() => {
        const w = window as unknown as {
            __gbDocuments: number;
            __gbContexts: number;
            __gbBlobs: Set<string>;
            __gbWrapped: string[];
        };
        return {
            documents: w.__gbDocuments,
            contexts: w.__gbContexts,
            outstanding: [...w.__gbBlobs].length,
            wrapped: w.__gbWrapped,
        };
    });

    // Without this the two counts below would mean nothing.
    expect(counts.documents, 'the walk reloaded the page, so nothing accumulated').toBe(1);

    // ...and so would the one after it, if nothing were being watched.
    expect(counts.wrapped.length, 'no AudioContext constructor was wrapped').toBeGreaterThan(0);

    // Nobody pressed play, so nothing should have been built to play with —
    // the engine and its context are constructed on the first tap and not
    // before. This is the half of the leak that browsing alone used to pay.
    expect(counts.contexts, 'browsing built an audio engine nobody asked to hear').toBe(0);

    // Every hymn in the recording carries its engraving as inline SVG, so the
    // <img> path that mints an object URL is not the one exercised here — this
    // is a floor, not a proof. What proves the URLs are handed back is
    // src/composables/useStoredFiles.spec.ts; what this catches is any path
    // that starts minting one per hymn and keeping it.
    expect(counts.outstanding, `${HYMNS} hymns left object URLs outstanding`).toBeLessThanOrEqual(
        1,
    );
});
