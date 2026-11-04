// @vitest-environment node
// The reader runs for real, on real archives, and jsdom's Blob has no stream().
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ArchiveFile, notationArchive } from '../../tests/e2e/support/notationArchive';

const findFileByName = vi.fn();
const fetchFile = vi.fn();
const bulkPut = vi.fn();

vi.mock('@/api/files.api', () => ({ findFileByName, fetchFile }));
vi.mock('@/db', () => ({ db: { files: { bulkPut } } }));
// errorHandler sits underneath the stores, and only its predicate is used here.
vi.mock('@/stores/user', () => ({ useUserStore: vi.fn() }));

const { NOTATION_BUNDLE_FILENAME, NOTATION_BUNDLE_MIN_FILES, syncNotationBundle } =
    await import('./notationBundleSync');
const { SESSION_ENDED_ERROR } = await import('@/services/errorHandler');

const STAMP = '2026-08-18T13:00:00.000Z';
const THE_SAME_STAMP_OVER_REST = '2026-08-18T13:00:00Z';
const AN_OLDER_STAMP = '2026-08-17T09:00:00.000Z';

const SVG_TYPE = 'image/svg+xml';

function archiveFile(id: string, modifiedOn: string | null = STAMP): ArchiveFile {
    return { id, type: SVG_TYPE, modifiedOn, content: `<svg id="${id}"/>` };
}

function idsOf(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `file-${i}`);
}

function wantedOf(ids: string[], modifiedOn: string | null = STAMP) {
    return ids.map((id) => ({ id, modifiedOn }));
}

/** The archive is in the library and answers with these files. */
function archiveHolds(files: ArchiveFile[]): void {
    findFileByName.mockResolvedValue({ id: 'archive-id', modifiedOn: STAMP });
    const bytes = notationArchive(files);
    fetchFile.mockResolvedValue(new Blob([new Uint8Array(bytes)]));
}

function sync(wanted: { id: string; modifiedOn: string | null }[]) {
    const progress: [number, number][] = [];
    const result = syncNotationBundle(
        wanted,
        (id) => `${id}.svg`,
        (current, total) => progress.push([current, total]),
    );
    return { result, progress };
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    findFileByName.mockReset();
    fetchFile.mockReset();
    bulkPut.mockReset();
    bulkPut.mockResolvedValue(undefined);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('when it asks at all', () => {
    // Literal counts, not the constant: its value is the decision under test. A
    // handful of changed files must not pull ~7 MB over a phone connection.
    it('stays off the network below the threshold', async () => {
        const { result } = sync(wantedOf(idsOf(199)));

        await expect(result).resolves.toEqual([]);
        expect(findFileByName).not.toHaveBeenCalled();
        expect(fetchFile).not.toHaveBeenCalled();
    });

    it('asks from the threshold on, and by the name the two repos agreed on', async () => {
        const ids = idsOf(200);
        archiveHolds(ids.map((id) => archiveFile(id)));

        const { result } = sync(wantedOf(ids));

        await expect(result).resolves.toHaveLength(200);
        expect(findFileByName).toHaveBeenCalledWith(NOTATION_BUNDLE_FILENAME);
        expect(NOTATION_BUNDLE_FILENAME).toBe('gesangbuch-noten.tar.gz');
    });

    it('asks for the bytes past the HTTP cache, because a rebuild keeps the URL', async () => {
        const ids = idsOf(NOTATION_BUNDLE_MIN_FILES);
        archiveHolds(ids.map((id) => archiveFile(id)));

        await sync(wantedOf(ids)).result;

        expect(fetchFile).toHaveBeenCalledWith('archive-id', { cache: 'no-cache' });
    });

    it('makes no request in a browser without DecompressionStream', async () => {
        vi.stubGlobal('DecompressionStream', undefined);

        const { result } = sync(wantedOf(idsOf(NOTATION_BUNDLE_MIN_FILES)));

        await expect(result).resolves.toEqual([]);
        expect(findFileByName).not.toHaveBeenCalled();
        expect(fetchFile).not.toHaveBeenCalled();
    });

    it('leaves it at the lookup when the library holds no archive', async () => {
        findFileByName.mockResolvedValue(null);

        const { result, progress } = sync(wantedOf(idsOf(NOTATION_BUNDLE_MIN_FILES)));

        await expect(result).resolves.toEqual([]);
        expect(fetchFile).not.toHaveBeenCalled();
        expect(bulkPut).not.toHaveBeenCalled();
        expect(progress).toEqual([]);
        // Not having one is an answer, not a failure.
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('what it takes from the archive', () => {
    const ids = idsOf(NOTATION_BUNDLE_MIN_FILES);

    it('stores rows in the shape the per-file path writes', async () => {
        archiveHolds(ids.map((id) => archiveFile(id)));

        await sync(wantedOf(ids)).result;

        const first = bulkPut.mock.calls[0][0][0];
        expect(Object.keys(first).sort()).toEqual(['blob', 'filename', 'id']);
        expect(first.id).toBe('file-0');
        expect(first.filename).toBe('file-0.svg');
        expect(first.blob.type).toBe(SVG_TYPE);
        expect(await first.blob.text()).toBe('<svg id="file-0"/>');
    });

    it('skips a file whose stamp in the archive is stale', async () => {
        archiveHolds(ids.map((id, i) => archiveFile(id, i === 3 ? AN_OLDER_STAMP : STAMP)));

        const stored = await sync(wantedOf(ids)).result;

        expect(stored).toHaveLength(ids.length - 1);
        expect(stored).not.toContain('file-3');
    });

    it('accepts the same instant in another serialisation', async () => {
        archiveHolds(ids.map((id) => archiveFile(id, THE_SAME_STAMP_OVER_REST)));

        await expect(sync(wantedOf(ids)).result).resolves.toHaveLength(ids.length);
    });

    it('accepts a file neither side has a stamp for', async () => {
        archiveHolds(ids.map((id) => archiveFile(id, null)));

        await expect(sync(wantedOf(ids, null)).result).resolves.toHaveLength(ids.length);
    });

    it('does not let a stamp on one side stand in for none on the other', async () => {
        archiveHolds(ids.map((id) => archiveFile(id, null)));

        await expect(sync(wantedOf(ids)).result).resolves.toEqual([]);
        expect(bulkPut).not.toHaveBeenCalled();
    });

    it('skips a file nobody asked for', async () => {
        archiveHolds([...ids.map((id) => archiveFile(id)), archiveFile('not-in-the-book')]);

        const stored = await sync(wantedOf(ids)).result;

        expect(stored).toHaveLength(ids.length);
        expect(stored).not.toContain('not-in-the-book');
        const written = bulkPut.mock.calls.flatMap(([rows]) =>
            rows.map((r: { id: string }) => r.id),
        );
        expect(written).not.toContain('not-in-the-book');
    });

    it('leaves out a wanted file the archive does not hold', async () => {
        archiveHolds(ids.slice(1).map((id) => archiveFile(id)));

        const stored = await sync(wantedOf(ids)).result;

        expect(stored).not.toContain('file-0');
        expect(stored).toHaveLength(ids.length - 1);
    });

    it('writes chunks of a hundred, and reports each one', async () => {
        const many = idsOf(250);
        archiveHolds(many.map((id) => archiveFile(id)));

        const { result, progress } = sync(wantedOf(many));
        await result;

        expect(bulkPut.mock.calls.map(([rows]) => rows.length)).toEqual([100, 100, 50]);
        expect(progress).toEqual([
            [0, 250],
            [100, 250],
            [200, 250],
            [250, 250],
        ]);
    });

    it('counts only what it means to store, so the total can be reached', async () => {
        archiveHolds(ids.map((id, i) => archiveFile(id, i === 0 ? AN_OLDER_STAMP : STAMP)));

        const { result, progress } = sync(wantedOf(ids));
        await result;

        expect(progress[0]).toEqual([0, ids.length - 1]);
        expect(progress.at(-1)).toEqual([ids.length - 1, ids.length - 1]);
    });

    it('says nothing about progress until the archive has been read', async () => {
        findFileByName.mockResolvedValue({ id: 'archive-id', modifiedOn: STAMP });
        let release!: (blob: Blob) => void;
        fetchFile.mockReturnValue(new Promise<Blob>((resolve) => (release = resolve)));

        const { result, progress } = sync(wantedOf(ids));
        await vi.waitFor(() => expect(fetchFile).toHaveBeenCalled());
        expect(progress).toEqual([]);

        release(new Blob([new Uint8Array(notationArchive([]))]));
        await result;
    });
});

describe('when it goes wrong', () => {
    const ids = idsOf(NOTATION_BUNDLE_MIN_FILES);

    it('rethrows a session that ended during the download', async () => {
        findFileByName.mockResolvedValue({ id: 'archive-id', modifiedOn: STAMP });
        fetchFile.mockRejectedValue(new Error(SESSION_ENDED_ERROR));

        await expect(sync(wantedOf(ids)).result).rejects.toThrow(SESSION_ENDED_ERROR);
        expect(warn).not.toHaveBeenCalled();
    });

    it('rethrows a session that ended during the lookup', async () => {
        findFileByName.mockRejectedValue(new Error(SESSION_ENDED_ERROR));

        await expect(sync(wantedOf(ids)).result).rejects.toThrow(SESSION_ENDED_ERROR);
    });

    it('returns empty when the lookup fails', async () => {
        findFileByName.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(sync(wantedOf(ids)).result).resolves.toEqual([]);
        expect(fetchFile).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledOnce();
    });

    it('returns empty when the download fails', async () => {
        findFileByName.mockResolvedValue({ id: 'archive-id', modifiedOn: STAMP });
        fetchFile.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(sync(wantedOf(ids)).result).resolves.toEqual([]);
        expect(warn).toHaveBeenCalledOnce();
    });

    it('stores nothing of a corrupt archive, not even its intact start', async () => {
        const archive = Buffer.from(notationArchive(ids.map((id) => archiveFile(id))));
        archive[archive.length - 8] ^= 0xff;
        findFileByName.mockResolvedValue({ id: 'archive-id', modifiedOn: STAMP });
        fetchFile.mockResolvedValue(new Blob([new Uint8Array(archive)]));

        await expect(sync(wantedOf(ids)).result).resolves.toEqual([]);
        expect(bulkPut).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledOnce();
    });

    it('keeps the ids of the chunks that went in before a later one failed', async () => {
        const many = idsOf(250);
        archiveHolds(many.map((id) => archiveFile(id)));
        bulkPut.mockResolvedValueOnce(undefined);
        bulkPut.mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));

        const stored = await sync(wantedOf(many)).result;

        expect(stored).toEqual(many.slice(0, 100));
        expect(bulkPut).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenCalledOnce();
    });

    it('copes with a storage failure that carries no error at all', async () => {
        // WebKit aborts a Blob transaction it will not take with no error object
        // (see tests/e2e/support/backend.ts), so `null` is a real thing to catch.
        archiveHolds(ids.map((id) => archiveFile(id)));
        bulkPut.mockRejectedValue(null);

        await expect(sync(wantedOf(ids)).result).resolves.toEqual([]);
    });
});
