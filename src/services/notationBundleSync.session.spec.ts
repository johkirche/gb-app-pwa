import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A session that ends under the notation archive, with nothing mocked between the
 * sync and the wire: the real files.api, refresh, error handler and stores, over a
 * stubbed fetch and an in-memory db.
 *
 * The other specs hand syncNotationBundle and syncAll a rejection and watch what
 * they do with it. That says nothing about whether the rejection can happen, and
 * for a while it could not: a turned-down refresh returns false and the API
 * functions went on to report a plain failed request, so a reader whose session had
 * gone sat through 1140 doomed requests and read "1140 Dateien konnten nicht
 * heruntergeladen werden" instead of being told to sign in.
 */

const authRows = new Map<string, { id: string }>();
const userRows = new Map<string, { id: string }>();
const songRows = new Map<string, { id: string }>();
const fileRows = new Map<string, { id: string; blob: Blob; filename: string }>();
const metaRows = new Map<string, { key: string; value: string }>();

vi.mock('@/db', () => {
    const singleRow = (rows: Map<string, { id: string }>) => ({
        toArray: async () => [...rows.values()],
        clear: async () => rows.clear(),
        add: async (row: { id: string }) => void rows.set(row.id, row),
    });
    return {
        db: {
            transaction: async (...args: unknown[]) => (args.at(-1) as () => Promise<void>)(),
            auth: singleRow(authRows),
            users: singleRow(userRows),
            songs: {
                count: async () => songRows.size,
                toArray: async () => [...songRows.values()],
                toCollection: () => ({ primaryKeys: async () => [...songRows.keys()] }),
                bulkPut: async (rows: { id: string }[]) => {
                    for (const row of rows) songRows.set(row.id, row);
                },
                bulkDelete: async (ids: string[]) => {
                    for (const id of ids) songRows.delete(id);
                },
            },
            files: {
                put: async (row: { id: string; blob: Blob; filename: string }) =>
                    void fileRows.set(row.id, row),
                toCollection: () => ({ primaryKeys: async () => [...fileRows.keys()] }),
                bulkDelete: async (ids: string[]) => {
                    for (const id of ids) fileRows.delete(id);
                },
            },
            meta: {
                get: async (key: string) => metaRows.get(key),
                put: async (row: { key: string; value: string }) => void metaRows.set(row.key, row),
                delete: async (key: string) => void metaRows.delete(key),
                bulkDelete: async (keys: string[]) => {
                    for (const key of keys) metaRows.delete(key);
                },
            },
        },
    };
});

const fetchSongManifest = vi.fn();
const fetchSongsByIds = vi.fn();
vi.mock('@/api/demo.api', () => ({ DemoUnavailableError: class {}, fetchDemoSongs: vi.fn() }));
vi.mock('@/api/songs.api', () => ({
    fetchChangeCounts: vi.fn(),
    fetchSongManifest,
    fetchSongsByIds,
    fetchSongsWithFiles: vi.fn(),
}));

/** One answer per route, and a request for anything else fails the test. */
const answers = {
    refresh: (): Response | Promise<Response> => invalidCredentials(),
    files: (): Response | Promise<Response> => json({ data: [] }),
    assets: (_id: string): Response | Promise<Response> => new Response('<svg/>'),
};
const network = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/auth/refresh')) return answers.refresh();
    if (url.includes('/files?')) return answers.files();
    const asset = url.match(/\/assets\/(.+)$/);
    if (asset) return answers.assets(asset[1]);
    throw new Error(`Nothing should be asking for ${url}`);
});
// Before anything is imported: the Directus SDK takes its fetch at import time.
vi.stubGlobal('fetch', network);

const { fetchFile, findFileByName } = await import('@/api/files.api');
const { SESSION_ENDED_ERROR } = await import('@/services/errorHandler');
const { syncNotationBundle } = await import('./notationBundleSync');
const { useSongsStore } = await import('@/stores/songs');
const { useUserStore } = await import('@/stores/user');

const STAMP = '2026-08-18T13:00:00.000Z';
const ARCHIVE_ID = 'archive-id';
const IN_AN_HOUR = () => Date.now() + 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function invalidCredentials(): Response {
    return json(
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
}

function unauthorized(): Response {
    return json({ errors: [{ message: 'Token expired.' }] }, 401);
}

function archiveIsInTheLibrary(): void {
    answers.files = () => json({ data: [{ id: ARCHIVE_ID, modified_on: STAMP }] });
}

function assetRequests(): string[] {
    return network.mock.calls.map(([input]) => String(input)).filter((u) => u.includes('/assets/'));
}

function refreshRequests(): number {
    return network.mock.calls.filter(([input]) => String(input).includes('/auth/refresh')).length;
}

/** A hundred songs, so two hundred files: enough for the archive to be asked. */
function theBook(count = 100) {
    const ids = Array.from({ length: count }, (_, i) => `s${i}`);
    const songs = ids.map((id) => ({
        id,
        notentextSvg: { id: `svg-${id}`, filename_download: `${id}.svg` },
        notentextMxml: { id: `mxml-${id}`, filename_download: `${id}.mxml` },
        noten: [],
    }));
    fetchSongManifest.mockResolvedValue(
        ids.map((id) => ({
            id,
            dateUpdated: STAMP,
            textDateUpdated: STAMP,
            melodieDateUpdated: STAMP,
            files: [
                { id: `svg-${id}`, modifiedOn: STAMP },
                { id: `mxml-${id}`, modifiedOn: STAMP },
            ],
        })),
    );
    fetchSongsByIds.mockResolvedValue(songs);
    return ids.flatMap((id) => [
        { id: `svg-${id}`, modifiedOn: STAMP },
        { id: `mxml-${id}`, modifiedOn: STAMP },
    ]);
}

function wanted(ids: { id: string; modifiedOn: string | null }[]) {
    return syncNotationBundle(
        ids,
        (id) => `${id}.bin`,
        () => undefined,
    );
}

/** Signed in, with a library on the device: what endSession needs to see. */
async function signedIn(expiresAt = IN_AN_HOUR()) {
    authRows.set('current', {
        id: 'current',
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt,
    } as { id: string });
    userRows.set('me', { id: 'me', email: 'leser@example.org' } as { id: string });
    songRows.set('already-stored', { id: 'already-stored' });

    const user = useUserStore();
    await user.initPromise;
    expect(user.authData).not.toBeNull();
    return user;
}

beforeEach(() => {
    for (const rows of [authRows, userRows, songRows, fileRows, metaRows]) rows.clear();
    network.mockClear();
    fetchSongManifest.mockReset();
    fetchSongsByIds.mockReset();
    setActivePinia(createPinia());

    answers.refresh = () => invalidCredentials();
    answers.files = () => json({ data: [] });
    answers.assets = () => new Response('<svg/>');

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('the session ending under the archive', () => {
    it('is told apart when it ends at the lookup', async () => {
        const user = await signedIn();
        answers.files = unauthorized;

        await expect(wanted(theBook())).rejects.toThrow(SESSION_ENDED_ERROR);

        expect(user.authData).toBeNull();
        expect(assetRequests()).toEqual([]);
    });

    it('is told apart when it ends at the download', async () => {
        const user = await signedIn();
        archiveIsInTheLibrary();
        answers.assets = unauthorized;

        await expect(wanted(theBook())).rejects.toThrow(SESSION_ENDED_ERROR);

        expect(user.authData).toBeNull();
        expect(assetRequests()).toHaveLength(1);
    });

    it('is told apart when the token ran out before the request went', async () => {
        // getCurrentToken tries the refresh first, loses the session there, and
        // sends the old token anyway: the 401 then has no refresh token left to try.
        const user = await signedIn(Date.now() - 1000);
        answers.files = unauthorized;

        await expect(wanted(theBook())).rejects.toThrow(SESSION_ENDED_ERROR);

        expect(user.authData).toBeNull();
        expect(refreshRequests()).toBe(1);
    });
});

describe('what must not read as a lost session', () => {
    it('leaves it at the fallback when the refresh fails on the network', async () => {
        const user = await signedIn();
        answers.files = unauthorized;
        answers.refresh = () => Promise.reject(new TypeError('Failed to fetch'));

        await expect(wanted(theBook())).resolves.toEqual([]);

        expect(user.authData).not.toBeNull();
    });

    it('leaves it at the fallback when the download dies the same way', async () => {
        const user = await signedIn();
        archiveIsInTheLibrary();
        answers.assets = unauthorized;
        answers.refresh = () => Promise.reject(new TypeError('Failed to fetch'));

        await expect(wanted(theBook())).resolves.toEqual([]);

        expect(user.authData).not.toBeNull();
    });

    it('leaves it at the fallback when a new token is refused too', async () => {
        const user = await signedIn();
        archiveIsInTheLibrary();
        answers.assets = unauthorized;
        answers.refresh = () =>
            json({ data: { access_token: 'new', refresh_token: 'new', expires: 900000 } });

        await expect(wanted(theBook())).resolves.toEqual([]);

        expect(user.authData).not.toBeNull();
    });

    it.each([403, 500])('takes a %i on the lookup for a failed request', async (status) => {
        const user = await signedIn();
        answers.files = () => json({ errors: [] }, status);

        await expect(findFileByName('anything')).rejects.not.toThrow(SESSION_ENDED_ERROR);

        expect(refreshRequests()).toBe(0);
        expect(user.authData).not.toBeNull();
    });
});

describe('a whole sync when the session ends', () => {
    it('says so, and sends none of the per-file requests', async () => {
        await signedIn();
        theBook();
        answers.files = unauthorized;

        const store = useSongsStore();
        await store.initPromise;
        await expect(store.syncAll()).rejects.toThrow(SESSION_ENDED_ERROR);

        expect(store.error).toMatch(/Sitzung ist abgelaufen/);
        expect(assetRequests()).toEqual([]);
        expect(store.failedFiles).toEqual([]);
        expect(store.lastSyncTime).toBeNull();
    });

    it('says so when it is the Bibelstellen step that lost it', async () => {
        // A sync too small to ask for the archive, so its notation arrives singly.
        // The rethrow in syncAll's Bibelstellen step stands for this.
        await signedIn();
        const files = theBook(1);
        answers.files = unauthorized;

        const store = useSongsStore();
        await store.initPromise;
        await expect(store.syncAll()).rejects.toThrow(SESSION_ENDED_ERROR);

        expect(store.error).toMatch(/Sitzung ist abgelaufen/);
        expect([...fileRows.keys()].sort()).toEqual(files.map((file) => file.id).sort());
    });
});

describe('fetchFile and the HTTP cache', () => {
    function cacheModes(): (RequestCache | undefined)[] {
        return network.mock.calls
            .filter(([input]) => String(input).includes('/assets/'))
            .map(([, init]) => init?.cache);
    }

    it('leaves a plain request to the browser', async () => {
        await signedIn();

        await fetchFile('svg-1');

        expect(cacheModes()).toEqual([undefined]);
    });

    it('holds to what it was asked for, also on the retry with a new token', async () => {
        await signedIn();
        const assets = [unauthorized(), new Response('<svg/>')];
        answers.assets = () => assets.shift()!;
        answers.refresh = () =>
            json({ data: { access_token: 'new', refresh_token: 'new', expires: 900000 } });

        await fetchFile(ARCHIVE_ID, { cache: 'no-cache' });

        expect(cacheModes()).toEqual(['no-cache', 'no-cache']);
    });
});
