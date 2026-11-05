import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/*
 * A session that outlives its access token.
 *
 * Directus' access token lasts a quarter of an hour, and it rotates the refresh
 * token every time one is used: the old one is dead from that moment on. So the
 * two things that can go wrong are an app left open long enough for the token to
 * run out, and two tabs sharing one refresh token. Neither needs the book behind
 * it, so this needs no recording: the backend here is a stand-in for those few
 * rules, with made-up tokens, and nothing else answers.
 */

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

// Up to two tabs loaded in full from the dev server, on a clock of their own: in the
// whole suite, Firefox can spend 30 to 40s on getting a single one up.
test.describe.configure({ timeout: 120_000 });

const backend = (process.env.VITE_BACKEND_URL ?? '').replace(/\/$/, '');

const QUARTER_OF_AN_HOUR = 15 * 60 * 1000;

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE',
};

const GEMEINDEN = [
    { id: 'gemeinde-1', name: 'Bremen', city: 'Bremen', coordinates: null },
    { id: 'gemeinde-2', name: 'Jena', city: 'Jena', coordinates: null },
];

/** The backend's side of the session, for the test to look at and to age. */
interface Session {
    access: string | null;
    refresh: string;
    /** Every refresh token presented, in order. */
    presented: string[];
    /** How many of them were turned down. */
    rejected: number;
    /** The token each saved profile came with. */
    saves: string[];
    /** How long a refresh takes, so that two can overlap. */
    refreshDelay: number;
}

async function serveBackend(context: BrowserContext): Promise<Session> {
    const session: Session = {
        access: 'e2e-access-1',
        refresh: 'e2e-refresh-1',
        presented: [],
        rejected: 0,
        saves: [],
        refreshDelay: 0,
    };
    let generation = 1;

    await context.route(`${backend}/**`, async (route) => {
        const request = route.request();
        const { pathname } = new URL(request.url());
        const json = (status: number, body: unknown) =>
            route.fulfill({ status, json: body, headers: CORS });

        if (request.method() === 'OPTIONS') {
            return route.fulfill({ status: 204, headers: CORS });
        }

        if (pathname === '/auth/refresh') {
            const presented = (request.postDataJSON() as { refresh_token: string }).refresh_token;
            session.presented.push(presented);
            // Checked and rotated on arrival, as the server would: a second request
            // with the same token loses, whichever answer gets back first.
            const valid = presented === session.refresh;
            if (valid) {
                generation += 1;
                session.access = `e2e-access-${generation}`;
                session.refresh = `e2e-refresh-${generation}`;
            } else {
                session.rejected += 1;
            }
            const answer = {
                access_token: session.access,
                refresh_token: session.refresh,
                expires: QUARTER_OF_AN_HOUR,
            };
            await new Promise((resolve) => setTimeout(resolve, session.refreshDelay));
            return valid
                ? json(200, { data: answer })
                : json(401, {
                      errors: [
                          {
                              message: 'Invalid user credentials.',
                              extensions: { code: 'INVALID_CREDENTIALS' },
                          },
                      ],
                  });
        }

        if (pathname === '/items/gemeinde') {
            return json(200, { data: GEMEINDEN });
        }

        if (pathname === '/users/me') {
            const token = request.headers().authorization?.replace('Bearer ', '') ?? '';
            if (!session.access || token !== session.access) {
                return json(401, {
                    errors: [{ message: 'Token expired.', extensions: { code: 'TOKEN_EXPIRED' } }],
                });
            }
            if (request.method() === 'PATCH') {
                session.saves.push(token);
                return json(200, { data: { id: 'e2e-user' } });
            }
            return json(200, {
                data: {
                    id: 'e2e-user',
                    first_name: 'Erika',
                    last_name: 'Muster',
                    avatar: null,
                    gemeinde: null,
                    app_settings: null,
                },
            });
        }

        return route.abort();
    });

    return session;
}

/** The session on the device, as a login leaves it, with the token just issued. */
async function signIn(page: Page) {
    await page.goto('/');
    // The login page is up, so the database has been opened and its tables exist.
    await expect(page.getByRole('button', { name: /^Überspringen/ })).toBeVisible({
        timeout: 20_000,
    });
    await page.evaluate(async (lifetime) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const open = indexedDB.open('GesangbuchDB');
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
        });
        const write = db.transaction(['auth', 'users'], 'readwrite');
        write.objectStore('auth').put({
            id: 'current',
            accessToken: 'e2e-access-1',
            refreshToken: 'e2e-refresh-1',
            expiresAt: Date.now() + lifetime,
        });
        write.objectStore('users').put({
            id: 'e2e-user',
            email: 'erika@example.invalid',
            firstName: 'Erika',
            lastName: 'Muster',
            role: 'activated',
            activated: true,
        });
        await new Promise((resolve, reject) => {
            write.oncomplete = resolve;
            write.onerror = () => reject(write.error);
        });
        db.close();
    }, QUARTER_OF_AN_HOUR);
}

/** To the account's row in the Einstellungen, signed in and with the profile read. */
async function openAccount(page: Page) {
    await page.goto('/tabs/einstellungen');
    await page
        .locator('main')
        .getByRole('button', { name: /^Konto/ })
        .click({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Gemeinde/ })).toBeVisible();
}

async function chooseGemeinde(page: Page, name: string) {
    await page.getByRole('button', { name: /^Gemeinde/ }).click();
    await page.getByRole('radio', { name }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
}

function expectSaved(page: Page, name: string) {
    return expect(
        page.getByRole('button', { name: new RegExp(`^Gemeinde\\s+${name}`) }),
    ).toBeVisible({ timeout: 15_000 });
}

/** The session as the device holds it, read past the app's own copy of it. */
function storedTokens(page: Page) {
    return page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const open = indexedDB.open('GesangbuchDB');
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
        });
        const read = db.transaction(['auth', 'users']);
        const count = (table: string) =>
            new Promise<number>((resolve) => {
                const request = read.objectStore(table).count();
                request.onsuccess = () => resolve(request.result);
            });
        const auth = read.objectStore('auth').getAll();
        const rows = await new Promise<{ refreshToken: string }[]>((resolve) => {
            auth.onsuccess = () => resolve(auth.result);
        });
        const users = await count('users');
        db.close();
        return { refreshTokens: rows.map((row) => row.refreshToken), users };
    });
}

/** Twenty minutes on the device's clock, and the first token dead on the server. */
async function letTokenRunOut(context: BrowserContext, session: Session) {
    await context.clock.fastForward(20 * 60 * 1000);
    session.access = null;
}

test.describe('a session outliving its token', () => {
    test('saves after the app has stood open past the token', async ({ context, page }) => {
        const session = await serveBackend(context);
        await context.clock.install();
        await signIn(page);
        await openAccount(page);
        // Nothing to renew yet: the token has only just been issued.
        await expect.poll(() => session.presented).toEqual([]);

        await letTokenRunOut(context, session);
        await chooseGemeinde(page, 'Bremen');

        await expectSaved(page, 'Bremen');
        expect(session.presented).toEqual(['e2e-refresh-1']);
        expect(session.saves).toEqual(['e2e-access-2']);
    });

    test('renews only once more after that, with the next token', async ({ context, page }) => {
        const session = await serveBackend(context);
        await context.clock.install();
        await signIn(page);
        await openAccount(page);

        await letTokenRunOut(context, session);
        await chooseGemeinde(page, 'Bremen');
        await expectSaved(page, 'Bremen');

        await letTokenRunOut(context, session);
        await chooseGemeinde(page, 'Jena');
        await expectSaved(page, 'Jena');

        expect(session.presented).toEqual(['e2e-refresh-1', 'e2e-refresh-2']);
        expect(session.saves).toEqual(['e2e-access-2', 'e2e-access-3']);
    });

    test('survives a tab holding a token another tab has used', async ({ context, page }) => {
        const session = await serveBackend(context);
        await context.clock.install();
        await signIn(page);
        await openAccount(page);
        const other = await context.newPage();
        await openAccount(other);

        // The first tab renews. The second still has the old refresh token in hand,
        // and presenting it would end the session on this device for both.
        await letTokenRunOut(context, session);
        await chooseGemeinde(page, 'Bremen');
        await expectSaved(page, 'Bremen');
        await chooseGemeinde(other, 'Jena');
        await expectSaved(other, 'Jena');

        expect(session.rejected).toBe(0);
        expect(session.presented).toEqual(['e2e-refresh-1']);
        expect(session.saves).toEqual(['e2e-access-2', 'e2e-access-2']);
        expect(await storedTokens(page)).toEqual({
            refreshTokens: ['e2e-refresh-2'],
            users: 1,
        });
    });

    test('survives two tabs renewing at the same moment', async ({ context, page }) => {
        const session = await serveBackend(context);
        await context.clock.install();
        await signIn(page);
        await openAccount(page);
        const other = await context.newPage();
        await openAccount(other);

        // Long enough for the second tab's save to start while the first one's
        // renewal is still under way.
        session.refreshDelay = 1500;
        await letTokenRunOut(context, session);
        await Promise.all([chooseGemeinde(page, 'Bremen'), chooseGemeinde(other, 'Jena')]);
        await expectSaved(page, 'Bremen');
        await expectSaved(other, 'Jena');

        expect(session.rejected).toBe(0);
        expect(session.presented).toEqual(['e2e-refresh-1']);
        expect(await storedTokens(page)).toEqual({
            refreshTokens: ['e2e-refresh-2'],
            users: 1,
        });
    });
});
