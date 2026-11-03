import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Directus client against the real SDK, with only `fetch` stubbed.
 *
 * The app keeps the session and refreshes it itself (useAuth). These pin that the
 * SDK does not do it a second time behind its back: Directus rotates refresh
 * tokens, so a refresh the app does not know about leaves it holding a dead one,
 * and its next refresh ends the session. That was the „Sitzung abgelaufen" a
 * quarter of an hour after signing in.
 */

const fetchMock = vi.fn();

function json(data: unknown) {
    return new Response(JSON.stringify({ data }), {
        headers: { 'Content-Type': 'application/json' },
    });
}

function paths() {
    return fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname);
}

vi.mock('@/config/directus', () => ({ directusConfig: { url: 'https://directus.example' } }));

// The SDK reads globalThis.fetch once, when it is first imported.
vi.stubGlobal('fetch', fetchMock);
const { directusClient } = await import('./directus');

beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () =>
        json({ access_token: 'access-1', refresh_token: 'refresh-1', expires: 900_000 }),
    );
});

afterEach(() => {
    vi.useRealTimers();
});

describe('directusClient', () => {
    it('arms no refresh of its own after login', async () => {
        await directusClient.login({ email: 'a@example.org', password: 'x' }, { mode: 'json' });

        // Well past the access token's 15 minutes.
        await vi.advanceTimersByTimeAsync(60 * 60_000);

        expect(paths()).toEqual(['/auth/login']);
    });

    it('does not refresh when a request asks for the token after it ran out', async () => {
        await directusClient.login({ email: 'a@example.org', password: 'x' }, { mode: 'json' });
        await vi.advanceTimersByTimeAsync(20 * 60_000);

        // What every REST and GraphQL request does first.
        expect(await directusClient.getToken()).toBe('access-1');
        expect(paths()).toEqual(['/auth/login']);
    });

    it('carries the access token the app hands it', async () => {
        await directusClient.setToken('access-from-the-store');
        fetchMock.mockImplementation(async () => json({ ok: true }));

        await directusClient.query('{ __typename }');

        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer access-from-the-store');
    });
});
