import { test as base, expect } from '@playwright/test';

import { hasRecording as fixtureExists, serveRecording, startRecording } from './recorder';

/**
 * The Gesangbuch's backend, recorded once and replayed forever after.
 *
 * The app talks to exactly three things — a GraphQL endpoint, Directus' auth
 * routes, and /assets/<id> for the two notation files a song carries — so
 * rather than hand-build a fake that would drift from the real schema the
 * moment someone adds a field, the suite records the real traffic and replays
 * it. What the tests run against is therefore not an imitation of the backend;
 * it is a photograph of it, taken on the day it was recorded.
 *
 * Record (needs a real account, writes tests/e2e/fixtures/):
 *   pnpm test:e2e:record
 *
 * Replay (the default; no network, no credentials, deterministic):
 *   pnpm test:e2e
 *
 * The recording holds real hymn texts and engravings, which are not ours to
 * redistribute, so tests/e2e/fixtures/ is git-ignored. Re-record when the
 * Directus schema moves — a replay that no longer matches is the signal.
 *
 * See recorder.ts for why this does not use Playwright's routeFromHAR.
 */

/** Set by `pnpm test:e2e:record`; everything else replays. */
export const RECORDING = process.env.E2E_RECORD === '1';

const backendUrl = process.env.VITE_BACKEND_URL;
if (!backendUrl) {
    throw new Error(
        'VITE_BACKEND_URL is not set. The e2e suite reads it from .env the same way ' +
            'the app does — run `cp .env.example .env` and fill it in.',
    );
}

/** Everything under the backend's origin, which is all the app ever calls. */
const BACKEND_GLOB = `${backendUrl.replace(/\/$/, '')}/**`;

/** Whether this clone has a recording yet. */
export const hasRecording = fixtureExists();

export const NO_RECORDING =
    'No backend recording in tests/e2e/fixtures/ — run `pnpm test:e2e:record` once ' +
    '(needs a real Directus account in .env).';

/**
 * Auth is stubbed on replay rather than recorded, on purpose.
 *
 * A recorded login would put the password on disk in plain text and pin every
 * later replay to that exact body; a recorded token would be a real credential
 * sitting in a fixture, expiring a quarter of an hour later. Neither belongs
 * there. The recorded GraphQL and asset entries are matched on method, URL and
 * body — never on who was carrying the token — so a made-up one replays exactly
 * as well as the real one did.
 */
const STUB_TOKEN = 'e2e-access-token';
const STUB_REFRESH = 'e2e-refresh-token';
// Far enough ahead that nothing under test decides to refresh mid-run.
const STUB_EXPIRES = 24 * 60 * 60 * 1000;

const session = {
    data: {
        access_token: STUB_TOKEN,
        refresh_token: STUB_REFRESH,
        expires: STUB_EXPIRES,
    },
};

export const test = base.extend<{ missingFromRecording: () => string[] }>({
    // The dev server registers a service worker (VitePWA devOptions.enabled),
    // and a request made *by* a service worker does not pass through route
    // handlers — the recording would be silently bypassed and the tests would
    // hit the real backend. Blocking it keeps every request in view. Offline
    // behaviour is the service worker's own subject, and needs its own spec.
    serviceWorkers: 'block',

    // `auto` because nothing else references it: a fixture no test names is a
    // fixture that never runs, and this one *is* the backend.
    missingFromRecording: [
        async ({ context }, use) => {
            if (RECORDING) {
                const finish = await startRecording(context, BACKEND_GLOB);
                await use(() => []);
                const stats = finish();
                console.log(
                    `  recorded ${stats.entries} responses, ` +
                        `${(stats.bytes / 1e6).toFixed(1)} MB raw -> ` +
                        `${(stats.onDisk / 1e6).toFixed(1)} MB on disk`,
                );
                return;
            }

            // Order matters, and it is the opposite of reading order: Playwright
            // checks the most recently registered handler first. The broad
            // replay goes down first so the narrow /auth/* stubs, registered
            // after it, are the ones that win.
            const missing = await serveRecording(context, BACKEND_GLOB);

            for (const path of ['login', 'refresh'] as const) {
                await context.route(`${backendUrl}/auth/${path}`, (route) =>
                    route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify(session),
                    }),
                );
            }
            await context.route(`${backendUrl}/auth/logout`, (route) =>
                route.fulfill({ status: 204, body: '' }),
            );

            await use(missing);
        },
        { auto: true },
    ],
});

export { expect };
