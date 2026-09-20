import { expect, test } from '@playwright/test';

/*
 * The pages that must work with nothing behind them.
 *
 * These are the `access: 'public'` routes in router/index.ts, and the reason
 * they are public is that each has to be reachable by someone who cannot get
 * in: the way in (login, registration, password reset), the two the law
 * requires to stay readable from outside (Impressum, Datenschutz), and the
 * catch-all that keeps a mistyped address from stranding a standalone PWA on a
 * blank page.
 *
 * No recording, no library, no session — which is the point. If one of these
 * ever starts needing the backend to render, this spec is where it shows.
 */

const PHONE = { width: 390, height: 844 };

test.use({ viewport: PHONE });

interface PublicPage {
    path: string;
    heading: RegExp;
    /** Something on the page that proves it rendered its own content. */
    contains: RegExp;
}

const PAGES: PublicPage[] = [
    { path: '/login', heading: /Gesangbuch/, contains: /Melden Sie sich an/i },
    { path: '/register', heading: /Willkommen/, contains: /Konto/i },
    { path: '/password-reset', heading: /Passwort zurücksetzen/, contains: /E-Mail/i },
    { path: '/impressum', heading: /Impressum/, contains: /Angaben gemäß/i },
    { path: '/datenschutz', heading: /Datenschutz/, contains: /Verantwortlicher/i },
];

for (const { path, heading, contains } of PAGES) {
    test(`${path} renders without a session`, async ({ page }) => {
        const failures: string[] = [];
        page.on('requestfailed', (r) => failures.push(`${r.url()} ${r.failure()?.errorText}`));

        await page.goto(path);

        // It stayed: a public route must not bounce to the login form.
        expect(new URL(page.url()).pathname).toBe(path);
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
        await expect(page.getByText(contains).first()).toBeVisible();

        // Nothing on a public page may depend on the backend being reachable.
        expect(
            failures.filter((f) => !f.includes('localhost')),
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
    await expect(page).toHaveURL(/\/(login|tabs\/lieder)/);
});

test('the legal pages are reachable from the login form', async ({ page }) => {
    // A reader who cannot get in must still be able to reach these; the login
    // page is the only door they have.
    await page.goto('/login');
    for (const [name, path] of [
        ['Impressum', '/impressum'],
        ['Datenschutz', '/datenschutz'],
    ] as const) {
        await page.goto('/login');
        await page.getByRole('link', { name }).first().click();
        await expect(page).toHaveURL(new RegExp(path));
    }
});

test('the hymn number is a typeable address', async ({ page }) => {
    // /lied/<nummer> is what a bulletin prints and what the share button hands
    // out. Without a library the app cannot resolve it, but it must reach the
    // song route rather than the catch-all — which is the difference between
    // "not downloaded yet" and "no such page".
    await page.goto('/lied/122-grosser-gott');
    expect(new URL(page.url()).pathname).not.toBe('/keine-solche-seite');
    // Unauthenticated and with no library, a 'library' route sends you to log in.
    await expect(page).toHaveURL(/\/login/);
});
