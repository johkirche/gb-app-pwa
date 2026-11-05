import { flushPromises, mount } from '@vue/test-utils';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Whether the download step believes a library is finished.
 *
 * The case that matters is a tab closed mid-download on a first install. The sync
 * writes the songs first and the notation after, and the archive stores nothing
 * until it has been read to its end, so that close can leave every song and not
 * one file. The real store runs here, over an in-memory db, because the question
 * is what it hydrates from there after the reload.
 */

const songRows = new Map<string, { id: string }>();
const fileRows = new Map<string, { id: string }>();
const meta = new Map<string, { key: string; value: string }>();

const fetchSongManifest = vi.fn();
const fetchSongsByIds = vi.fn();
const fetchFile = vi.fn();
const syncNotationBundle = vi.fn();

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
            put: async (row: { id: string }) => void fileRows.set(row.id, row),
            toCollection: () => ({ primaryKeys: async () => [...fileRows.keys()] }),
            bulkDelete: async (ids: string[]) => {
                for (const id of ids) fileRows.delete(id);
            },
        },
        meta: {
            get: async (key: string) => meta.get(key),
            put: async (row: { key: string; value: string }) => void meta.set(row.key, row),
            delete: async (key: string) => void meta.delete(key),
        },
    },
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/stores/user', () => ({ useUserStore: vi.fn() }));
vi.mock('@/api/demo.api', () => ({ DemoUnavailableError: class {}, fetchDemoSongs: vi.fn() }));
vi.mock('@/api/files.api', () => ({ fetchFile }));
vi.mock('@/api/songs.api', () => ({
    fetchChangeCounts: vi.fn(),
    fetchSongManifest,
    fetchSongsByIds,
    fetchSongsWithFiles: vi.fn(),
}));
vi.mock('@/services/bibelstellenSync', () => ({ syncBibelstellen: vi.fn(async () => undefined) }));
vi.mock('@/services/notationBundleSync', () => ({
    NOTATION_BUNDLE_MIN_FILES: 200,
    syncNotationBundle,
}));

const { default: OnboardingPage } = await import('./OnboardingPage.vue');
const { useSongsStore } = await import('@/stores/songs');

const STAMP = '2026-08-18T13:00:00.000Z';
const FINISHED = 'Das Gesangbuch ist jetzt auf diesem Gerät.';

function song(id: string) {
    return {
        id,
        notentextSvg: { id: `svg-${id}`, filename_download: `${id}.svg` },
        notentextMxml: null,
        noten: [],
    };
}

/** What the page does on a reload: read the db, then walk to the download step. */
async function reloadOntoDownloadStep() {
    const pinia = createPinia();
    setActivePinia(pinia);
    await useSongsStore().initPromise;

    const wrapper = mount(OnboardingPage, {
        global: {
            plugins: [pinia],
            stubs: { InstallPWAStep: true, GemeindeStep: true, StepIndicator: true },
        },
    });
    await flushPromises();

    wrapper.findComponent({ name: 'InstallPWAStep' }).vm.$emit('next');
    await flushPromises();
    wrapper.findComponent({ name: 'GemeindeStep' }).vm.$emit('next');
    await flushPromises();
    return wrapper;
}

beforeEach(() => {
    songRows.clear();
    fileRows.clear();
    meta.clear();
    localStorage.clear();
    vi.clearAllMocks();

    songRows.set('1', song('1'));
    fetchSongManifest.mockResolvedValue([
        {
            id: '1',
            dateUpdated: STAMP,
            textDateUpdated: STAMP,
            melodieDateUpdated: STAMP,
            files: [{ id: 'svg-1', modifiedOn: STAMP }],
        },
    ]);
    fetchSongsByIds.mockResolvedValue([song('1')]);
    fetchFile.mockImplementation(async () => new Blob(['<svg/>']));
    syncNotationBundle.mockResolvedValue([]);
});

describe('the download step on a library that is already there', () => {
    it('finishes the download that a closed tab cut off', async () => {
        const wrapper = await reloadOntoDownloadStep();

        expect(fetchSongManifest).toHaveBeenCalledOnce();
        expect(fetchFile).toHaveBeenCalledWith('svg-1');
        expect(fileRows.has('svg-1')).toBe(true);
        expect(wrapper.text()).toContain(FINISHED);
    });

    it('does not call it finished while that download is running', async () => {
        let release!: () => void;
        fetchFile.mockImplementation(async () => {
            await new Promise<void>((resolve) => (release = resolve));
            return new Blob(['<svg/>']);
        });

        const wrapper = await reloadOntoDownloadStep();

        expect(wrapper.text()).not.toContain(FINISHED);

        release();
        await flushPromises();
        expect(wrapper.text()).toContain(FINISHED);
    });

    it('skips the sync for a library whose last one finished', async () => {
        meta.set('lastSyncTime', { key: 'lastSyncTime', value: STAMP });

        const wrapper = await reloadOntoDownloadStep();

        expect(fetchSongManifest).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain(FINISHED);
    });

    it('runs the sync again when the last one left files behind', async () => {
        meta.set('lastSyncTime', { key: 'lastSyncTime', value: STAMP });
        meta.set('failedFiles', {
            key: 'failedFiles',
            value: JSON.stringify([{ id: 'svg-1', filename: '1.svg' }]),
        });

        await reloadOntoDownloadStep();

        expect(fetchSongManifest).toHaveBeenCalledOnce();
    });
});
