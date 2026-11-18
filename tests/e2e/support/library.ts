import type { BrowserContext, Page, Route } from '@playwright/test';
import { chromium, expect, firefox, webkit } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { serveRecording } from './recorder';

/*
 * A browser holding the whole Gesangbuch, ready to read.
 *
 * Most of what is left to cover — a hymn, the favourites, a playlist, the
 * Gottesdienst — needs a library behind it, and syncing one per test would cost
 * five seconds a test for no new coverage: sync.spec.ts already watches the
 * sync itself. So a spec file opens one of these in beforeAll and its tests
 * share it. They are reads, not writes, apart from the few that say otherwise
 * and run in serial.
 */

const backendUrl = process.env.VITE_BACKEND_URL ?? '';
const BACKEND_GLOB = `${backendUrl.replace(/\/$/, '')}/**`;

const STUB_SESSION = {
    data: {
        access_token: 'e2e-access-token',
        refresh_token: 'e2e-refresh-token',
        expires: 24 * 60 * 60 * 1000,
    },
};

/** Phone first, like the readability walk: it is the shape the app is read in. */
export const PHONE = { width: 390, height: 844 };

const ENGINES = { chromium, firefox, webkit };

export interface LibraryFixture {
    page: Page;
    context: BrowserContext;
    close: () => Promise<void>;
}

/**
 * Open a context, put the recorded backend behind it, and sync the book in.
 *
 * WebKit gets a profile on disk: it will not put a Blob into IndexedDB in an
 * ephemeral context, and the notation files are Blobs. See support/backend.ts.
 */
export async function openLibrary(
    browserName: 'chromium' | 'firefox' | 'webkit',
    baseURL: string,
): Promise<LibraryFixture> {
    const engine = ENGINES[browserName];
    let context: BrowserContext;
    let profile: string | undefined;
    let closeBrowser: (() => Promise<void>) | undefined;

    if (browserName === 'webkit') {
        profile = mkdtempSync(join(tmpdir(), 'gb-e2e-lib-'));
        context = await engine.launchPersistentContext(profile, {
            serviceWorkers: 'block',
            viewport: PHONE,
            baseURL,
        });
    } else {
        const browser = await engine.launch();
        closeBrowser = () => browser.close();
        context = await browser.newContext({
            serviceWorkers: 'block',
            viewport: PHONE,
            baseURL,
        });
    }

    await serveRecording(context, BACKEND_GLOB);
    await stubAuth(context);

    const page = await context.newPage();
    await syncLibrary(page);

    return {
        page,
        context,
        close: async () => {
            await context.close();
            await closeBrowser?.();
            if (profile) rmSync(profile, { recursive: true, force: true });
        },
    };
}

/**
 * Sign-in and renewal answered with made-up tokens, as support/backend.ts
 * explains: at Directus' own routes and at the register extension's, which the
 * app uses first. The device list answers with this device alone, so the
 * account settings have something to show and nothing reaches the backend.
 */
export async function stubAuth(context: BrowserContext, session: unknown = STUB_SESSION) {
    const base = backendUrl.replace(/\/$/, '');
    const extension = `${base}/directus-user-register-extension`;

    // The backend is another origin, and these are JSON posts: the browser
    // asks first (OPTIONS) and reads the answer only if it may. Registered
    // after the replay, these handlers are the ones the preflight reaches, so
    // they answer it as the replay would, and send the same headers along.
    const answer = (route: Route, status: number, body?: unknown) => {
        const request = route.request();
        const cors = { 'access-control-allow-origin': request.headers()['origin'] || '*' };
        if (request.method() === 'OPTIONS') {
            return route.fulfill({
                status: 204,
                headers: {
                    ...cors,
                    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
                    'access-control-allow-headers':
                        request.headers()['access-control-request-headers'] ||
                        'authorization, content-type',
                },
                body: '',
            });
        }
        return body === undefined
            ? route.fulfill({ status, headers: cors, body: '' })
            : route.fulfill({
                  status,
                  headers: cors,
                  contentType: 'application/json',
                  body: JSON.stringify(body),
              });
    };

    for (const url of [
        `${base}/auth/login`,
        `${base}/auth/refresh`,
        `${extension}/login`,
        `${extension}/sitzung`,
    ]) {
        await context.route(url, (route) => answer(route, 200, session));
    }
    await context.route(`${extension}/geraete**`, (route) => {
        const now = new Date().toISOString();
        return answer(route, 200, {
            data: {
                limit: 4,
                devices: [
                    {
                        id: 1,
                        name: 'Testgerät · Browser',
                        last_seen: now,
                        signed_in: now,
                        current: true,
                    },
                ],
            },
        });
    });
    await context.route(`${base}/auth/logout`, (route) => answer(route, 204));
}

/**
 * The password way in, as the sign-in offers it beside the code, to the page
 * that says the book comes next, and on into the onboarding.
 */
export async function signInWithPassword(page: Page, email: string, password: string) {
    await page.goto('/anmelden');
    await page.getByRole('button', { name: 'Mit Passwort anmelden' }).click();
    await page
        .getByLabel(/E-Mail/i)
        .first()
        .fill(email);
    await page
        .getByLabel(/Passwort/i)
        .first()
        .fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByRole('button', { name: 'Lieder laden' }).click({ timeout: 60_000 });
    await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
}

/** Sign in and let onboarding pull the book down from the recording. */
export async function syncLibrary(page: Page) {
    await signInWithPassword(page, 'e2e@example.invalid', 'e2e-password');
    await walkOnboarding(page, 180_000);
    await page.locator('nav[aria-label="Hauptnavigation"]:visible').waitFor({ timeout: 30_000 });
}

/**
 * Through the onboarding: the Gemeinde, the download step — which offers
 * „Weiter" once the book is down — then past the tour to the profile and its
 * „Fertig". No Gemeinde is chosen and nothing is typed into the profile: both
 * are saved without a request when left empty, so the recording never learns of
 * a write and a replay never needs one.
 */
export async function walkOnboarding(page: Page, downloadBudgetMs: number) {
    // Pressed from the keyboard, not clicked. Where the service worker runs
    // (offline.spec.ts) its „Das Gesangbuch ist jetzt offline verfügbar" comes
    // up at the bottom, over these buttons, and a pointer moved there to click
    // keeps a toast from going: the click would wait for ever.
    const press = (name: string) => page.getByRole('button', { name }).press('Enter');

    await expect(
        page.getByRole('heading', { name: 'Zu welcher Gemeinde gehören Sie?' }),
    ).toBeVisible();
    await press('Weiter');
    await expect(page.getByRole('heading', { name: 'Inhalte herunterladen' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible({
        timeout: downloadBudgetMs,
    });
    await press('Weiter');

    await press('Überspringen');
    await expect(page.getByRole('heading', { name: 'Wie dürfen wir Sie nennen?' })).toBeVisible();
    await press('Fertig');
}

/** The tab bar that is on screen — a second, hidden one exists for ≥ lg. */
export function nav(page: Page) {
    return page.locator('nav[aria-label="Hauptnavigation"]:visible');
}

const TAB_PATHS: Record<string, string> = {
    Lieder: '/tabs/lieder',
    Playlisten: '/tabs/playlisten',
    Ablauf: '/tabs/ablauf',
    Einstellungen: '/tabs/einstellungen',
};

/**
 * Go to a tab, by address rather than by pressing it.
 *
 * A song page, a playlist and the settings sections are all top-level routes
 * with no tab bar on them, so a helper that pressed the bar would only work
 * from inside the bar — which is never where a test that just finished
 * something is standing. The bar itself is exercised where that is the point:
 * readability-scale.spec.ts walks it, song.spec.ts comes back to it.
 */
export async function openTab(page: Page, label: keyof typeof TAB_PATHS | string) {
    const path = TAB_PATHS[label];
    if (!path) throw new Error(`No such tab: ${label}`);
    await page.goto(path);
    await nav(page).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(300);
}
