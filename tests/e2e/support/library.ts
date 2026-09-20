import type { BrowserContext, Page } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';
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
    for (const path of ['login', 'refresh'] as const) {
        await context.route(`${backendUrl}/auth/${path}`, (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(STUB_SESSION),
            }),
        );
    }
    await context.route(`${backendUrl}/auth/logout`, (route) =>
        route.fulfill({ status: 204, body: '' }),
    );

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

/** Log in and let onboarding pull the book down from the recording. */
export async function syncLibrary(page: Page) {
    await page.goto('/login');
    await page
        .getByLabel(/E-Mail/i)
        .first()
        .fill('e2e@example.invalid');
    await page
        .getByLabel(/Passwort/i)
        .first()
        .fill('e2e-password');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Weiter' }).click();

    const done = page.getByRole('button', { name: 'Fertig' });
    await done.waitFor({ state: 'visible', timeout: 180_000 });
    await done.click();
    await page.locator('nav[aria-label="Hauptnavigation"]:visible').waitFor({ timeout: 30_000 });
}

/** The tab bar that is on screen — a second, hidden one exists for ≥ lg. */
export function nav(page: Page) {
    return page.locator('nav[aria-label="Hauptnavigation"]:visible');
}

const TAB_PATHS: Record<string, string> = {
    Lieder: '/tabs/lieder',
    Playlisten: '/tabs/playlisten',
    Gottesdienst: '/tabs/gottesdienst',
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
