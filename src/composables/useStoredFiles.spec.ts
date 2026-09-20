import { effectScope, nextTick } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStoredFiles } from '@/composables/useStoredFiles';

// What the store would have handed back, without a Dexie behind it.
const getOrFetchFileBlob = vi.fn();
vi.mock('@/stores/songs', () => ({
    useSongsStore: () => ({ getOrFetchFileBlob }),
}));

let minted: string[] = [];
let revoked: string[] = [];

/** How many URLs are still holding their blob. */
function outstanding(): string[] {
    return minted.filter((url) => !revoked.includes(url));
}

beforeEach(() => {
    setActivePinia(createPinia());
    minted = [];
    revoked = [];
    let counter = 0;
    URL.createObjectURL = vi.fn(() => {
        const url = `blob:test/${++counter}`;
        minted.push(url);
        return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
        revoked.push(url);
    });
    getOrFetchFileBlob.mockReset();
    getOrFetchFileBlob.mockResolvedValue(new Blob(['<svg />'], { type: 'image/svg+xml' }));
});

describe('getFileUrl / releaseFileUrl (Issue #24)', () => {
    it('gibt die URL wieder frei, die der Aufrufer zurückreicht', async () => {
        const { getFileUrl, releaseFileUrl } = useStoredFiles();

        const url = await getFileUrl('file-1');
        expect(outstanding()).toEqual([url]);

        releaseFileUrl(url);
        expect(outstanding()).toEqual([]);
    });

    it('verträgt null — der Aufrufer hält die URL in einem Ref, das leer beginnt', () => {
        const { releaseFileUrl } = useStoredFiles();
        expect(() => releaseFileUrl(null)).not.toThrow();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    // Das Lesen blättert durch viele Lieder; jedes einzelne Notenbild, das
    // nicht freigegeben wird, bleibt im Speicher, bis der Tab neu lädt.
    it('hinterlässt nach zehn Liedern höchstens eine offene URL', async () => {
        const { getFileUrl, releaseFileUrl } = useStoredFiles();

        let held: string | null = null;
        for (let i = 0; i < 10; i++) {
            const next = await getFileUrl(`file-${i}`);
            releaseFileUrl(held);
            held = next;
        }

        expect(minted).toHaveLength(10);
        expect(outstanding()).toEqual([held]);

        releaseFileUrl(held);
        expect(outstanding()).toEqual([]);
    });
});

describe('useFileUrl (Issue #24)', () => {
    it('gibt die URL frei, wenn der Scope endet', async () => {
        const scope = effectScope();
        const handle = scope.run(() => useStoredFiles().useFileUrl('file-1'))!;

        await nextTick();
        await nextTick();
        expect(handle.url.value).toBe(minted[0]);

        scope.stop();
        expect(outstanding()).toEqual([]);
        expect(handle.url.value).toBeNull();
    });

    // Der Scope endet, während der Abruf noch unterwegs ist: die URL entsteht
    // erst danach, und niemand wäre mehr da, der sie freigeben könnte.
    it('gibt eine URL frei, die erst nach dem Scope-Ende eintrifft', async () => {
        let deliver: (blob: Blob) => void = () => {};
        getOrFetchFileBlob.mockReturnValue(
            new Promise<Blob>((resolve) => {
                deliver = resolve;
            }),
        );

        const scope = effectScope();
        const handle = scope.run(() => useStoredFiles().useFileUrl('file-1'))!;

        scope.stop();
        deliver(new Blob(['<svg />']));
        await nextTick();
        await nextTick();

        expect(outstanding()).toEqual([]);
        expect(handle.url.value).toBeNull();
    });
});
