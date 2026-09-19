import { test as base, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * The Gesangbuch's backend, recorded once and replayed forever after.
 *
 * The app talks to exactly three things — a GraphQL endpoint, Directus' auth
 * routes, and /assets/<id> for the two notation files a song carries — so
 * rather than hand-build a fake that would drift from the real schema the
 * moment someone adds a field, the suite records the real traffic into a HAR
 * and replays it. What the tests run against is therefore not an imitation of
 * the backend; it is a photograph of it, taken on the day it was recorded.
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
 */

const HAR = 'tests/e2e/fixtures/directus.har';

/**
 * Whether this clone has a recording yet. A spec that needs the backend says
 * so with `test.skip(needsRecording, NO_RECORDING)`, so a fresh clone reports
 * "skipped, run pnpm test:e2e:record" instead of an ENOENT out of Playwright's
 * internals — and never a green suite that quietly tested nothing.
 */
export const hasRecording = existsSync(HAR);

export const NO_RECORDING =
    'No backend recording in tests/e2e/fixtures/ — run `pnpm test:e2e:record` once ' +
    '(needs a real Directus account in .env).';

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

/**
 * Auth is stubbed rather than recorded, on purpose.
 *
 * A recorded login would put the password in the HAR in plain text and pin
 * every later replay to that exact body; a recorded token would be a real
 * credential sitting in a fixture file, expiring a quarter of an hour later.
 * Neither belongs on disk. The recorded GraphQL and asset entries are matched
 * on URL, method and body — never on who was carrying the token — so a made-up
 * one replays exactly as well as the real one did.
 */
const STUB_TOKEN = 'e2e-access-token';
const STUB_REFRESH = 'e2e-refresh-token';
// Far enough ahead that nothing under test decides to refresh mid-run.
const STUB_EXPIRES = 24 * 60 * 60 * 1000;

function authStub(body: unknown) {
    return {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
    };
}

export const test = base.extend({
    // The dev server registers a service worker (VitePWA devOptions.enabled),
    // and a request made *by* a service worker does not pass through route
    // handlers — the HAR would be silently bypassed and the tests would hit
    // the real backend. Blocking it keeps every request in view. Offline
    // behaviour is the service worker's own subject, and needs its own spec.
    serviceWorkers: 'block',

    context: async ({ context }, use) => {
        await context.routeFromHAR(HAR, {
            url: BACKEND_GLOB,
            // While recording, let everything through and write it down. While
            // replaying, abort anything the recording does not answer, so a
            // request that quietly reaches the real backend fails loudly
            // instead of passing the suite on live data.
            update: RECORDING,
            updateMode: 'minimal',
            updateContent: 'embed',
            notFound: RECORDING ? 'fallback' : 'abort',
        });

        // Registered after the HAR so it wins: Playwright matches the most
        // recently registered handler first.
        if (!RECORDING) {
            await context.route(`${backendUrl}/auth/login`, (route) =>
                route.fulfill(
                    authStub({
                        data: {
                            access_token: STUB_TOKEN,
                            refresh_token: STUB_REFRESH,
                            expires: STUB_EXPIRES,
                        },
                    }),
                ),
            );
            await context.route(`${backendUrl}/auth/refresh`, (route) =>
                route.fulfill(
                    authStub({
                        data: {
                            access_token: STUB_TOKEN,
                            refresh_token: STUB_REFRESH,
                            expires: STUB_EXPIRES,
                        },
                    }),
                ),
            );
            await context.route(`${backendUrl}/auth/logout`, (route) =>
                route.fulfill({ status: 204, body: '' }),
            );
        }

        await use(context);
    },
});

export { expect };
