import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * How syncAll uses the notation archive: when it asks, and what the per-file
 * path is left with. The archive's own behaviour has its own spec; this one is
 * about the seam, which is where "slower, never wrong" is won or lost.
 */

const files = new Map<string, { id: string; blob: Blob; filename: string }>();
const songRows = new Map<string, { id: string }>();
const meta = new Map<string, { key: string; value: string }>();

const syncNotationBundle = vi.fn();
const fetchFile = vi.fn();
const fetchSongManifest = vi.fn();
const fetchSongsByIds = vi.fn();
const fetchSongsWithFiles = vi.fn();

vi.mock('@/db', () => ({
    db: {
        transaction: async (...args: unknown[]) => (args.at(-1) as () => Promise<void>)(),
        songs: {
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
            put: async (row: { id: string; blob: Blob; filename: string }) => {
                files.set(row.id, row);
            },
            toCollection: () => ({ primaryKeys: async () => [...files.keys()] }),
            bulkDelete: async (ids: string[]) => {
                for (const id of ids) files.delete(id);
            },
        },
        meta: {
            get: async (key: string) => meta.get(key),
            put: async (row: { key: string; value: string }) => void meta.set(row.key, row),
            delete: async (key: string) => void meta.delete(key),
        },
    },
}));
vi.mock('@/stores/user', () => ({ useUserStore: vi.fn() }));
vi.mock('@/api/demo.api', () => ({ DemoUnavailableError: class {}, fetchDemoSongs: vi.fn() }));
vi.mock('@/api/files.api', () => ({ fetchFile }));
vi.mock('@/api/songs.api', () => ({
    fetchChangeCounts: vi.fn(),
    fetchSongManifest,
    fetchSongsByIds,
    fetchSongsWithFiles,
}));
vi.mock('@/services/bibelstellenSync', () => ({ syncBibelstellen: vi.fn(async () => undefined) }));
vi.mock('@/services/notationBundleSync', () => ({
    NOTATION_BUNDLE_MIN_FILES: 200,
    syncNotationBundle,
}));

const { useSongsStore } = await import('./songs');
const { SESSION_ENDED_ERROR } = await import('@/services/errorHandler');

const STAMP = '2026-08-18T13:00:00.000Z';

function song(id: string) {
    return {
        id,
        notentextSvg: { id: `svg-${id}`, filename_download: `${id}.svg` },
        notentextMxml: { id: `mxml-${id}`, filename_download: `${id}.mxml` },
        noten: [],
    };
}

function manifestEntry(id: string) {
    return {
        id,
        dateUpdated: STAMP,
        textDateUpdated: STAMP,
        melodieDateUpdated: STAMP,
        files: [
            { id: `svg-${id}`, modifiedOn: STAMP },
            { id: `mxml-${id}`, modifiedOn: STAMP },
        ],
    };
}

/** What the real thing does: write rows, then report the ids. */
function archiveStores(ids: string[]) {
    syncNotationBundle.mockImplementation(
        async (_wanted, filenameOf: (id: string) => string, onProgress) => {
            for (const id of ids) {
                files.set(id, { id, blob: new Blob(['archive']), filename: filenameOf(id) });
            }
            onProgress(ids.length, ids.length);
            return ids;
        },
    );
}

async function freshStore() {
    setActivePinia(createPinia());
    const store = useSongsStore();
    await store.initPromise;
    return store;
}

const ALL_FILES = ['svg-1', 'mxml-1', 'svg-2', 'mxml-2'];

beforeEach(() => {
    files.clear();
    songRows.clear();
    meta.clear();
    vi.clearAllMocks();

    fetchSongManifest.mockResolvedValue([manifestEntry('1'), manifestEntry('2')]);
    fetchSongsByIds.mockResolvedValue([song('1'), song('2')]);
    fetchFile.mockImplementation(async (id: string) => new Blob([`single ${id}`]));
    syncNotationBundle.mockResolvedValue([]);
});

describe('syncAll and the notation archive', () => {
    it('offers the archive what the diff says is missing, with the manifest stamps', async () => {
        const store = await freshStore();
        await store.syncAll();

        expect(syncNotationBundle).toHaveBeenCalledOnce();
        expect(syncNotationBundle.mock.calls[0][0]).toEqual(
            ALL_FILES.map((id) => ({ id, modifiedOn: STAMP })),
        );
    });

    it('does not offer it a file already held at its current stamp', async () => {
        files.set('svg-1', { id: 'svg-1', blob: new Blob(['held']), filename: '1.svg' });
        meta.set('fileStamps', { key: 'fileStamps', value: JSON.stringify({ 'svg-1': STAMP }) });

        const store = await freshStore();
        await store.syncAll();

        expect(syncNotationBundle.mock.calls[0][0].map((file: { id: string }) => file.id)).toEqual(
            ALL_FILES.filter((id) => id !== 'svg-1'),
        );
    });

    it('leaves the per-file path only what the archive did not store', async () => {
        archiveStores(['svg-1', 'mxml-1', 'svg-2']);

        const store = await freshStore();
        await store.syncAll();

        expect(fetchFile.mock.calls.map(([id]) => id)).toEqual(['mxml-2']);
        expect(store.failedFiles).toEqual([]);
        expect(store.lastSyncTime).not.toBeNull();
    });

    it('fetches everything singly when the archive stored nothing', async () => {
        const store = await freshStore();
        await store.syncAll();

        expect(fetchFile.mock.calls.map(([id]) => id).sort()).toEqual([...ALL_FILES].sort());
    });

    it('makes no per-file request when the archive stored everything', async () => {
        archiveStores(ALL_FILES);

        const store = await freshStore();
        await store.syncAll();

        expect(fetchFile).not.toHaveBeenCalled();
        expect(files.size).toBe(ALL_FILES.length);
    });

    it('names stored rows from the same index as the per-file path', async () => {
        archiveStores(['svg-1']);

        const store = await freshStore();
        await store.syncAll();

        expect(files.get('svg-1')?.filename).toBe('1.svg');
        expect(files.get('mxml-2')?.filename).toBe('2.mxml');
    });

    it('falls back on the id for a file no song names', async () => {
        const store = await freshStore();
        await store.syncAll();

        const filenameOf = syncNotationBundle.mock.calls[0][1] as (id: string) => string;
        expect(filenameOf('stray')).toBe('stray.bin');
    });

    it('does not use the archive for a full sync', async () => {
        const store = await freshStore();
        await store.syncAll({ full: true });

        expect(syncNotationBundle).not.toHaveBeenCalled();
        expect(fetchFile).toHaveBeenCalledTimes(ALL_FILES.length);
    });

    it('does not use the archive without a manifest', async () => {
        fetchSongManifest.mockResolvedValue(null);
        fetchSongsWithFiles.mockResolvedValue({
            songs: [song('1'), song('2')],
            fileIds: ALL_FILES,
        });

        const store = await freshStore();
        await store.syncAll();

        expect(syncNotationBundle).not.toHaveBeenCalled();
        expect(fetchFile).toHaveBeenCalledTimes(ALL_FILES.length);
    });

    it('records stamps for archive rows without being told about them', async () => {
        archiveStores(ALL_FILES);

        const store = await freshStore();
        await store.syncAll();

        expect(JSON.parse(meta.get('fileStamps')!.value)).toEqual(
            Object.fromEntries(ALL_FILES.map((id) => [id, STAMP])),
        );
    });

    it('still clears an old failed-file row when nothing is left to fetch', async () => {
        meta.set('failedFiles', {
            key: 'failedFiles',
            value: JSON.stringify([{ id: 'svg-1', filename: '1.svg' }]),
        });
        archiveStores(ALL_FILES);

        const store = await freshStore();
        await store.syncAll();

        expect(meta.has('failedFiles')).toBe(false);
    });

    it('holds the file count back until the archive has been read', async () => {
        let readArchive!: () => void;
        const read = new Promise<void>((resolve) => (readArchive = resolve));
        const seen: { phase: string; total: number }[] = [];
        syncNotationBundle.mockImplementation(async (_wanted, _filenameOf, onProgress) => {
            seen.push({ phase: store.syncProgress.phase, total: store.syncProgress.total });
            await read;
            onProgress(0, 4);
            seen.push({ phase: store.syncProgress.phase, total: store.syncProgress.total });
            onProgress(4, 4);
            seen.push({ phase: store.syncProgress.phase, total: store.syncProgress.current });
            return [];
        });

        const store = await freshStore();
        const syncing = store.syncAll();
        await vi.waitFor(() => expect(syncNotationBundle).toHaveBeenCalled());
        readArchive();
        await syncing;

        expect(seen).toEqual([
            { phase: 'files', total: 0 },
            { phase: 'files', total: 4 },
            { phase: 'files', total: 4 },
        ]);
    });

    it('ends the sync over a session that ended, with no per-file requests', async () => {
        syncNotationBundle.mockRejectedValue(new Error(SESSION_ENDED_ERROR));

        const store = await freshStore();
        await expect(store.syncAll()).rejects.toThrow(SESSION_ENDED_ERROR);

        expect(fetchFile).not.toHaveBeenCalled();
        expect(store.error).toMatch(/Sitzung ist abgelaufen/);
    });
});

describe('a file replaced in place whose new bytes did not arrive', () => {
    const OLD_STAMP = '2026-01-01T00:00:00.000Z';

    /** Everything held and current, except that svg-1 still has its old bytes. */
    function holdEverything() {
        for (const id of ALL_FILES) {
            files.set(id, { id, blob: new Blob(['old bytes']), filename: `${id}.bin` });
        }
        meta.set('fileStamps', {
            key: 'fileStamps',
            value: JSON.stringify({ ...stampsOf(ALL_FILES), 'svg-1': OLD_STAMP }),
        });
    }

    function stampsOf(ids: string[]) {
        return Object.fromEntries(ids.map((id) => [id, STAMP]));
    }

    it('keeps the old stamp, so the next sync fetches it again', async () => {
        holdEverything();
        fetchFile.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        const store = await freshStore();
        await store.syncAll();

        expect(store.failedFiles.map((file) => file.id)).toEqual(['svg-1']);
        expect(JSON.parse(meta.get('fileStamps')!.value)['svg-1']).toBe(OLD_STAMP);
        expect(store.lastSyncTime).toBeNull();

        await store.syncAll();

        expect(fetchFile.mock.calls.map(([id]) => id)).toEqual(['svg-1', 'svg-1']);
        expect(await files.get('svg-1')?.blob.text()).toBe('single svg-1');
        expect(JSON.parse(meta.get('fileStamps')!.value)).toEqual(stampsOf(ALL_FILES));
        expect(store.failedFiles).toEqual([]);
        expect(store.lastSyncTime).not.toBeNull();
    });

    it('fetches it once more after a retry, which has no manifest to stamp it from', async () => {
        holdEverything();
        fetchFile.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        const store = await freshStore();
        await store.syncAll();
        await store.retryFailedFiles();

        expect(await files.get('svg-1')?.blob.text()).toBe('single svg-1');
        expect(JSON.parse(meta.get('fileStamps')!.value)['svg-1']).toBe(OLD_STAMP);

        await store.syncAll();

        expect(fetchFile.mock.calls.map(([id]) => id)).toEqual(['svg-1', 'svg-1', 'svg-1']);
        expect(JSON.parse(meta.get('fileStamps')!.value)['svg-1']).toBe(STAMP);
    });
});

describe('retryFailedFiles', () => {
    /** A hundred songs, so two hundred files: the archive's threshold exactly. */
    const SONG_IDS = Array.from({ length: 100 }, (_, i) => `s${i}`);
    const FILE_IDS = SONG_IDS.flatMap((id) => [`svg-${id}`, `mxml-${id}`]);

    function failedBefore(ids: string[]) {
        meta.set('failedFiles', {
            key: 'failedFiles',
            value: JSON.stringify(ids.map((id) => ({ id, filename: `${id}.bin` }))),
        });
    }

    beforeEach(() => {
        for (const id of SONG_IDS) songRows.set(id, song(id));
        fetchSongManifest.mockResolvedValue(SONG_IDS.map(manifestEntry));
        fetchSongsByIds.mockResolvedValue(SONG_IDS.map(song));
    });

    it('asks the archive again when enough failed for it to pay', async () => {
        failedBefore(FILE_IDS);
        archiveStores(FILE_IDS);

        const store = await freshStore();
        await store.retryFailedFiles();

        expect(syncNotationBundle).toHaveBeenCalledOnce();
        expect(fetchFile).not.toHaveBeenCalled();
        expect(store.failedFiles).toEqual([]);
        expect(store.lastSyncTime).not.toBeNull();
    });

    it('collects again whatever the archive could not supply and still fails', async () => {
        failedBefore(FILE_IDS);
        archiveStores(FILE_IDS.slice(1));
        fetchFile.mockRejectedValue(new TypeError('Failed to fetch'));

        const store = await freshStore();
        await store.retryFailedFiles();

        expect(store.failedFiles.map((file) => file.id)).toEqual([FILE_IDS[0]]);
        expect(store.lastSyncTime).toBeNull();
    });

    it('does the rest singly and leaves the song data alone below that', async () => {
        const few = FILE_IDS.slice(0, 199);
        failedBefore(few);

        const store = await freshStore();
        await store.retryFailedFiles();

        expect(syncNotationBundle).not.toHaveBeenCalled();
        expect(fetchSongManifest).not.toHaveBeenCalled();
        expect(fetchFile.mock.calls.map(([id]) => id).sort()).toEqual([...few].sort());
        expect(store.failedFiles).toEqual([]);
    });

    it.each([
        ['before the sync got anywhere', () => fetchSongManifest],
        ['at the archive', () => syncNotationBundle],
    ])('says why when the session ended %s', async (_where, step) => {
        failedBefore(FILE_IDS);
        step().mockRejectedValue(new Error(SESSION_ENDED_ERROR));

        const store = await freshStore();
        await expect(store.retryFailedFiles()).rejects.toThrow(SESSION_ENDED_ERROR);

        // The onboarding page hides the error while it has a list to offer, so the
        // list makes way for the reason. It is still in the db for the next start.
        expect(store.error).toMatch(/Sitzung ist abgelaufen/);
        expect(store.failedFiles).toEqual([]);
        expect(JSON.parse(meta.get('failedFiles')!.value)).toHaveLength(FILE_IDS.length);
        expect(fetchFile).not.toHaveBeenCalled();
    });

    it('never turns into a sync on a demo, which has no session to run one', async () => {
        failedBefore(FILE_IDS);
        meta.set('demoKey', { key: 'demoKey', value: 'demo' });

        const store = await freshStore();
        await store.retryFailedFiles();

        expect(fetchSongManifest).not.toHaveBeenCalled();
        expect(syncNotationBundle).not.toHaveBeenCalled();
        expect(fetchFile).toHaveBeenCalledTimes(FILE_IDS.length);
        expect(store.demoKey).toBe('demo');
    });
});
