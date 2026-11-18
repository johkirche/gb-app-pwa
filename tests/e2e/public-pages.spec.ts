import { expect, test } from '@playwright/test';

/*
 * The pages that must work with nothing behind them.
 *
 * These are the `access: 'public'` routes in router/index.ts, and the reason
 * they are public is that each has to be reachable by someone who cannot get
 * in: the way in (start page, install page, sign-in, password reset), the two the law
 * requires to stay readable from outside (Impressum, Datenschutz), and the
 * catch-all that keeps a mistyped address from stranding a standalone PWA on a
 * blank page.
 *
 * No recording, no library, no session — which is the point. If one of these
 * ever starts needing the backend to render, this spec is where it shows.
 *
 * Two of them do ask it for something: the Impressum and the Datenschutz-
 * erklärung read the organisation's entries from Directus (rechtstexte). The
 * backend is cut off here, so that asking is allowed and depending is not —
 * each page has to stand without an answer, and say that the entries follow.
 */

const PHONE = { width: 390, height: 844 };

test.use({ viewport: PHONE });

interface PublicPage {
    path: string;
    heading: RegExp;
    /** Something on the page that proves it rendered its own content. */
    contains: RegExp;
    /** The one backend path it may ask for: an answer it can do without. */
    asks?: string;
}

const PAGES: PublicPage[] = [
    { path: '/willkommen', heading: /Gesangbuch/, contains: /Gesangbuch nutzen/ },
    { path: '/installieren', heading: /installieren/i, contains: /Browser/ },
    { path: '/anmelden', heading: /Anmelden/, contains: /sechsstelligen Code/ },
    { path: '/password-reset', heading: /Passwort zurücksetzen/, contains: /E-Mail/i },
    {
        path: '/impressum',
        heading: /Impressum/,
        contains: /Angaben gemäß/i,
        asks: '/items/rechtstexte',
    },
    {
        path: '/datenschutz',
        heading: /Datenschutz/,
        contains: /Verantwortlicher/i,
        asks: '/items/rechtstexte',
    },
    { path: '/vorschau-beendet', heading: /Danke fürs Ausprobieren/, contains: /Auch ohne Netz/ },
];

for (const { path, heading, contains, asks } of PAGES) {
    test(`${path} renders without a session`, async ({ page }) => {
        // The backend cut off: whatever leaves the app's own origin fails.
        const asked: string[] = [];
        await page.route(
            (url) => url.hostname !== 'localhost',
            (route) => {
                asked.push(new URL(route.request().url()).pathname);
                return route.abort();
            },
        );

        await page.goto(path);

        // It stayed: a public route must not bounce to the sign-in.
        expect(new URL(page.url()).pathname).toBe(path);
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
        await expect(page.getByText(contains).first()).toBeVisible();

        if (asks) {
            // Without the answer the entries say when they will come, rather
            // than leaving a gap or a placeholder.
            await expect(
                page.getByText('Wird geladen, sobald das Gerät mit dem Internet verbunden ist.'),
            ).not.toHaveCount(0);
        }

        // Nothing else on a public page may reach the backend at all.
        expect(
            asked.filter((p) => p !== asks),
            'a public page reached off-origin',
        ).toEqual([]);
    });
}

test('an unknown address lands on the 404, not a blank page', async ({ page }) => {
    await page.goto('/keine-solche-seite');
    expect(new URL(page.url()).pathname).toBe('/keine-solche-seite');
    await expect(page.getByRole('heading', { name: /nicht gefunden/i })).toBeVisible();
    // The page names the address it could not find, and offers the way back.
    await expect(page.getByText('/keine-solche-seite')).toBeVisible();
    await page.getByRole('button', { name: /Zu den Liedern/i }).click();
    await expect(page).toHaveURL(/\/(willkommen|tabs\/lieder)/);
});

for (const door of ['/willkommen', '/anmelden']) {
    test(`the legal pages are reachable from ${door}`, async ({ page }) => {
        // A reader who cannot get in must still be able to reach these; the
        // way in is the only door they have.
        for (const [name, path] of [
            ['Impressum', '/impressum'],
            ['Datenschutz', '/datenschutz'],
        ] as const) {
            await page.goto(door);
            await page.getByRole('link', { name }).first().click();
            await expect(page).toHaveURL(new RegExp(path));
        }
    });
}

test('the old addresses of the way in still lead there', async ({ page }) => {
    await page.goto('/login?reason=account_deleted');
    await expect(page).toHaveURL(/\/anmelden/);
    await expect(page.getByText(/Ihr Konto wurde gelöscht/)).toBeVisible();

    await page.goto('/register');
    await expect(page).toHaveURL(/\/anmelden/);
});

test('a browser with nothing on it starts at the start page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/willkommen/);
});

test('the hymn number is a typeable address', async ({ page }) => {
    // /lied/<nummer> is what a bulletin prints and what the share button hands
    // out. Without a library the app cannot resolve it, but it must reach the
    // song route rather than the catch-all — which is the difference between
    // "not downloaded yet" and "no such page".
    await page.goto('/lied/122-grosser-gott');
    expect(new URL(page.url()).pathname).not.toBe('/keine-solche-seite');
    // Unauthenticated and with no library, a 'library' route sends you in at
    // the start page.
    await expect(page).toHaveURL(/\/willkommen/);
});
