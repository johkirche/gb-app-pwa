import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The session's one way to the server: `sessionFetch`, and the renewal under it.
 *
 * `refreshAuthToken` — Directus rotates refresh tokens, so a second renewal
 * with an already-used token is refused. Renewals go to the register extension's
 * /sitzung, which keeps the device's place on the account in step, and to
 * /auth/refresh only where the extension does not have the route. The download loop runs 5 file fetches at a
 * time, and before the in-flight promise was shared every one of them fired its own
 * refresh: four were refused, and that took the reader's offline library with it.
 * Across tabs the same race runs through a lock and the database.
 *
 * `sessionFetch` — every request to Directus is signed here and renewed here, so
 * that nothing else has to. The /auth requests go out unsigned: Directus checks a
 * bearer before it routes a request, and a dead one sent with a renewal had it
 * refused before the refresh token was looked at. That ended every session a quarter
 * of an hour into a pause, whatever REFRESH_TOKEN_TTL said.
 */

const BACKEND = 'https://backend.test';
const SITZUNG = '/directus-user-register-extension/sitzung';
const DEVICE = { id: 'geraet-im-test', name: 'Testgerät · Chrome' };

const handleInvalidCredentials = vi.fn();

function freshUserStore() {
    const store = {
        authData: {
            accessToken: 'old-access',
            refreshToken: 'old-refresh',
            expiresAt: 0,
        } as { accessToken: string; refreshToken: string; expiresAt: number } | null,
        isTokenExpired: (() => false) as () => boolean,
        adoptStoredTokens: vi.fn(async () => false),
        updateTokens: vi.fn(
            async (
                accessToken: string,
                refreshToken: string,
                expiresAt: number,
                _refreshExpiresAt?: number,
            ) => {
                store.authData = { accessToken, refreshToken, expiresAt };
            },
        ),
    };
    return store;
}
let userStore = freshUserStore();

vi.mock('@/stores/user', () => ({ useUserStore: () => userStore }));
vi.mock('@/config/directus', () => ({ directusConfig: { url: 'https://backend.test' } }));
vi.mock('@/services/device', () => ({ thisDevice: () => DEVICE }));
vi.mock('@/services/errorHandler', () => ({
    SESSION_ENDED_ERROR: 'Invalid credentials - user logged out',
    handleInvalidCredentials: (...args: unknown[]) => handleInvalidCredentials(...args),
}));

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const renewed = (n = 2) =>
    json({
        data: {
            access_token: `access-${n}`,
            refresh_token: `refresh-${n}`,
            expires: 900000,
            refresh_expires: 1_800_000_000_000,
        },
    });
const refused = () =>
    json(
        {
            errors: [
                {
                    message: 'Invalid user credentials.',
                    extensions: { code: 'INVALID_CREDENTIALS' },
                },
            ],
        },
        401,
    );
const tokenExpired = () =>
    json({ errors: [{ message: 'Token expired.', extensions: { code: 'TOKEN_EXPIRED' } }] }, 401);

/** What an extension without the route answers. */
const routeNotFound = () =>
    json(
        { errors: [{ message: "Route doesn't exist.", extensions: { code: 'ROUTE_NOT_FOUND' } }] },
        404,
    );

/** One answer per route; anything else fails the test. */
const answers = {
    refresh: (): Response | Promise<Response> => renewed(),
    directus: (): Response | Promise<Response> => {
        throw new Error('Directus itself is only asked where the extension has no /sitzung');
    },
    items: (): Response | Promise<Response> => json({ data: [] }),
};
const network = vi.fn(async (input: string | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === `${BACKEND}${SITZUNG}`) return answers.refresh();
    if (url === `${BACKEND}/auth/refresh`) return answers.directus();
    if (url.startsWith(`${BACKEND}/items/`)) return answers.items();
    throw new Error(`Nothing should be asking for ${url}`);
});

/** The calls that went to one path, with what they carried. */
function sent(path: string) {
    return network.mock.calls
        .filter(([input]) => String(input).startsWith(`${BACKEND}${path}`))
        .map(([, init]) => ({
            authorization: new Headers(init?.headers).get('Authorization'),
            body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
            cache: init?.cache,
        }));
}

const { refreshAuthToken, sessionFetch } = await import('./session');

beforeEach(() => {
    userStore = freshUserStore();
    handleInvalidCredentials.mockReset();
    // A refused renewal ends the session in the store, as the real handler does.
    handleInvalidCredentials.mockImplementation(async () => {
        userStore.authData = null;
    });
    network.mockClear();
    answers.refresh = () => renewed();
    answers.directus = () => {
        throw new Error('Directus itself is only asked where the extension has no /sitzung');
    };
    answers.items = () => json({ data: [] });
    vi.stubGlobal('fetch', network);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('refreshAuthToken', () => {
    it('sends exactly one network refresh for concurrent callers', async () => {
        let release: (response: Response) => void = () => {};
        answers.refresh = () => new Promise((resolve) => (release = resolve));

        // Five parallel callers, mirroring the download loop's batch size.
        const calls = Promise.all(Array.from({ length: 5 }, () => refreshAuthToken()));
        await vi.waitFor(() => expect(sent(SITZUNG)).toHaveLength(1));
        release(renewed());

        expect(await calls).toEqual([true, true, true, true, true]);
        expect(sent(SITZUNG)).toHaveLength(1);
        expect(userStore.updateTokens).toHaveBeenCalledOnce();
        expect(userStore.authData?.refreshToken).toBe('refresh-2');
    });

    it('starts a fresh request once the previous one has settled', async () => {
        await refreshAuthToken();
        await refreshAuthToken();

        expect(sent(SITZUNG)).toHaveLength(2);
    });

    it('sends the refresh token and the device in the body, and no access token', async () => {
        await refreshAuthToken();

        expect(sent(SITZUNG)).toEqual([
            {
                authorization: null,
                body: { refresh_token: 'old-refresh', geraet: DEVICE },
                cache: undefined,
            },
        ]);
    });

    it('keeps the end of the session the server names', async () => {
        await refreshAuthToken();

        expect(userStore.updateTokens).toHaveBeenCalledWith(
            'access-2',
            'refresh-2',
            expect.any(Number),
            1_800_000_000_000,
        );
    });

    it('renews at Directus where the extension has no /sitzung yet', async () => {
        answers.refresh = routeNotFound;
        answers.directus = () => renewed(3);

        expect(await refreshAuthToken()).toBe(true);

        expect(sent('/auth/refresh')).toEqual([
            {
                authorization: null,
                body: { refresh_token: 'old-refresh', mode: 'json' },
                cache: undefined,
            },
        ]);
        expect(userStore.authData?.refreshToken).toBe('refresh-3');
    });

    it('ends the session when the server turns the refresh token down', async () => {
        answers.refresh = refused;

        expect(await refreshAuthToken()).toBe(false);

        // Over, but nothing deleted: the reader's library has to outlive a token.
        expect(handleInvalidCredentials).toHaveBeenCalledExactlyOnceWith('session_expired');
    });

    it.each([
        ['on the network', () => Promise.reject(new TypeError('Failed to fetch'))],
        ['with a server error', () => json({ errors: [] }, 503)],
    ])('leaves the session standing when the refresh fails %s', async (_, answer) => {
        answers.refresh = answer;

        const results = await Promise.all(Array.from({ length: 5 }, () => refreshAuthToken()));

        expect(results).toEqual([false, false, false, false, false]);
        expect(sent(SITZUNG)).toHaveLength(1);
        expect(handleInvalidCredentials).not.toHaveBeenCalled();
        expect(userStore.authData).not.toBeNull();
    });

    // Across tabs: each has its own copy of the store, and a refresh token one of
    // them has used is dead for all. The whole round through a real browser's lock
    // and database is in tests/e2e/session.spec.ts.
    it('asks the server nothing when another tab has already renewed', async () => {
        userStore.adoptStoredTokens.mockResolvedValue(true);

        expect(await refreshAuthToken()).toBe(true);
        expect(network).not.toHaveBeenCalled();
    });

    it('renews with the newer token when that one has run out as well', async () => {
        userStore.isTokenExpired = () => true;
        userStore.adoptStoredTokens.mockImplementation(async () => {
            userStore.authData = {
                accessToken: 'newer',
                refreshToken: 'newer-refresh',
                expiresAt: 0,
            };
            return true;
        });

        await refreshAuthToken();

        expect(sent(SITZUNG)[0].body).toEqual({
            refresh_token: 'newer-refresh',
            geraet: DEVICE,
        });
    });

    it('waits behind another tab, and only then looks at the tokens', async () => {
        let letGo: () => void = () => {};
        const held = new Promise<void>((resolve) => (letGo = resolve));
        vi.stubGlobal('navigator', {
            locks: { request: (_name: string, work: () => unknown) => held.then(work) },
        });

        const renewal = refreshAuthToken();
        await Promise.resolve();
        expect(userStore.adoptStoredTokens).not.toHaveBeenCalled();
        expect(network).not.toHaveBeenCalled();

        letGo();
        expect(await renewal).toBe(true);
        expect(userStore.adoptStoredTokens).toHaveBeenCalledOnce();
        expect(sent(SITZUNG)).toHaveLength(1);
    });
});

describe('sessionFetch', () => {
    const ITEMS = `${BACKEND}/items/app_liste`;

    it("signs a request to Directus with the session's token", async () => {
        await sessionFetch(ITEMS);

        expect(sent('/items/')).toEqual([
            { authorization: 'Bearer old-access', body: undefined, cache: undefined },
        ]);
        expect(sent(SITZUNG)).toEqual([]);
    });

    it('renews first when the token is about to run out', async () => {
        userStore.isTokenExpired = () => userStore.authData?.accessToken === 'old-access';

        await sessionFetch(ITEMS);

        expect(sent(SITZUNG)).toHaveLength(1);
        expect(sent('/items/').map((call) => call.authorization)).toEqual(['Bearer access-2']);
    });

    it('renews on a 401 and asks once more, as it was asked', async () => {
        const items = [tokenExpired(), json({ data: ['ok'] })];
        answers.items = () => items.shift()!;

        const response = await sessionFetch(ITEMS, { cache: 'no-cache' });

        expect(await response.json()).toEqual({ data: ['ok'] });
        expect(sent('/items/')).toEqual([
            { authorization: 'Bearer old-access', body: undefined, cache: 'no-cache' },
            { authorization: 'Bearer access-2', body: undefined, cache: 'no-cache' },
        ]);
    });

    it('rejects with SESSION_ENDED_ERROR when the renewal is turned down', async () => {
        answers.items = tokenExpired;
        answers.refresh = refused;

        await expect(sessionFetch(ITEMS)).rejects.toThrow('Invalid credentials - user logged out');
        expect(handleInvalidCredentials).toHaveBeenCalledOnce();
    });

    it('rejects the same way when the session ends before the request goes', async () => {
        userStore.isTokenExpired = () => true;
        answers.refresh = refused;

        await expect(sessionFetch(ITEMS)).rejects.toThrow('Invalid credentials - user logged out');
        // Nothing went out on a session that was already over.
        expect(sent('/items/')).toEqual([]);
    });

    it('answers with the 401 when the renewal fails on the network', async () => {
        answers.items = tokenExpired;
        answers.refresh = () => Promise.reject(new TypeError('Failed to fetch'));

        const response = await sessionFetch(ITEMS);

        // A failed request, as offline: the session is still there.
        expect(response.status).toBe(401);
        expect(userStore.authData).not.toBeNull();
        expect(handleInvalidCredentials).not.toHaveBeenCalled();
    });

    it('sends /auth requests as they were made: unsigned, and never renewed', async () => {
        answers.directus = refused;

        const response = await sessionFetch(`${BACKEND}/auth/refresh`, {
            method: 'POST',
            body: JSON.stringify({ refresh_token: 'x', mode: 'json' }),
        });

        expect(response.status).toBe(401);
        expect(sent('/auth/refresh')).toEqual([
            { authorization: null, body: { refresh_token: 'x', mode: 'json' }, cache: undefined },
        ]);
        expect(handleInvalidCredentials).not.toHaveBeenCalled();
    });

    it('leaves a request that brings its own token alone', async () => {
        // The login asks for the user with the token it has just been given.
        await sessionFetch(ITEMS, { headers: { Authorization: 'Bearer just-issued' } });

        expect(sent('/items/').map((call) => call.authorization)).toEqual(['Bearer just-issued']);
    });

    it('asks as nobody when there is no session', async () => {
        userStore.authData = null;

        await sessionFetch(ITEMS);

        expect(sent('/items/').map((call) => call.authorization)).toEqual([null]);
    });

    it('never hands the token to anybody but Directus', async () => {
        network.mockImplementationOnce(async () => json({}));

        await sessionFetch('https://elsewhere.test/items/app_liste');

        expect(new Headers(network.mock.calls[0][1]?.headers).get('Authorization')).toBeNull();
    });
});
