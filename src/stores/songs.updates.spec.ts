import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two pieces of the songs store that libraryUpdates leans on: how many
 * songs an update would bring, and a sync that fails without hiding the book.
 */

const songRows = new Map<string, { id: string; dateUpdated?: string | null }>();
const meta = new Map<string, { key: string; value: string }>();

const fetchChangeCounts = vi.fn();
const fetchSongManifest = vi.fn();

vi.mock('@/db', () => ({
    db: {
        songs: {
            toArray: async () => [...songRows.values()],
            toCollection: () => ({ primaryKeys: async () => [...songRows.keys()] }),
        },
        files: { toCollection: () => ({ primaryKeys: async () => [] }) },
        meta: {
            get: async (key: string) => meta.get(key),
            put: async (row: { key: string; value: string }) => void meta.set(row.key, row),
            delete: async (key: string) => void meta.delete(key),
        },
    },
}));
vi.mock('@/stores/user', () => ({ useUserStore: vi.fn() }));
vi.mock('@/api/demo.api', () => ({ DemoUnavailableError: class {}, fetchDemoSongs: vi.fn() }));
vi.mock('@/api/files.api', () => ({ fetchFile: vi.fn() }));
vi.mock('@/api/songs.api', () => ({
    fetchChangeCounts,
    fetchSongManifest,
    fetchSongsByIds: vi.fn(),
    fetchSongsWithFiles: vi.fn(),
}));
vi.mock('@/services/bibelstellenSync', () => ({ syncBibelstellen: vi.fn(async () => undefined) }));
vi.mock('@/services/notationBundleSync', () => ({
    NOTATION_BUNDLE_MIN_FILES: 200,
    syncNotationBundle: vi.fn(async () => []),
}));
vi.mock('@/services/storage', () => ({ requestPersistentStorage: vi.fn(async () => true) }));

const { useSongsStore } = await import('./songs');

const STAMP = '2026-11-01T10:00:00.000Z';

async function storeWith(count: number) {
    for (let i = 1; i <= count; i++) songRows.set(String(i), { id: String(i), dateUpdated: STAMP });
    setActivePinia(createPinia());
    const store = useSongsStore();
    await store.initPromise;
    return store;
}

beforeEach(() => {
    songRows.clear();
    meta.clear();
    vi.clearAllMocks();
});

describe('countPendingUpdates', () => {
    it('counts the songs that moved since the newest stamp held here', async () => {
        fetchChangeCounts.mockResolvedValue({ total: 3, changed: 1 });
        const store = await storeWith(3);

        expect(await store.countPendingUpdates()).toBe(1);
        expect(fetchChangeCounts).toHaveBeenCalledWith(STAMP);
    });

    it('is zero when nothing moved', async () => {
        fetchChangeCounts.mockResolvedValue({ total: 3, changed: 0 });
        const store = await storeWith(3);

        expect(await store.countPendingUpdates()).toBe(0);
        expect(await store.checkForUpdates()).toBe(false);
    });

    it('counts an added song once, though both counts show it', async () => {
        fetchChangeCounts.mockResolvedValue({ total: 4, changed: 1 });
        const store = await storeWith(3);

        expect(await store.countPendingUpdates()).toBe(1);
    });

    it('counts a withdrawn song, which leaves no stamp behind', async () => {
        fetchChangeCounts.mockResolvedValue({ total: 2, changed: 0 });
        const store = await storeWith(3);

        expect(await store.countPendingUpdates()).toBe(1);
        expect(await store.checkForUpdates()).toBe(true);
    });

    it('says nothing when the stamps are unreadable and the size agrees', async () => {
        fetchChangeCounts.mockResolvedValue({ total: 3, changed: null });
        const store = await storeWith(3);

        expect(await store.countPendingUpdates()).toBeNull();
        expect(await store.checkForUpdates()).toBeNull();
    });

    it('says nothing when the server cannot be asked', async () => {
        fetchChangeCounts.mockRejectedValue(new TypeError('Failed to fetch'));
        const store = await storeWith(3);

        expect(await store.countPendingUpdates()).toBeNull();
    });
});

describe('syncAll({ quiet })', () => {
    it('leaves no error on the page when it fails', async () => {
        fetchSongManifest.mockRejectedValue(new Error('Network down'));
        const store = await storeWith(3);

        await expect(store.syncAll({ quiet: true })).rejects.toThrow('Network down');
        expect(store.error).toBeNull();
        expect(store.isSyncing).toBe(false);
    });

    it('still reports the failure of a sync the reader started', async () => {
        fetchSongManifest.mockRejectedValue(new Error('Network down'));
        const store = await storeWith(3);

        await expect(store.syncAll()).rejects.toThrow('Network down');
        expect(store.error).toBe('Network down');
    });
});
