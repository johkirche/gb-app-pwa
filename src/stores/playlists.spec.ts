import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Playlist } from '@/db';

// An in-memory stand-in for the playlists table. put() structured-clones, as
// IndexedDB does, so a reactive proxy reaching it fails the test the way it
// fails the app (DataCloneError).
const rows = new Map<string, Playlist>();

vi.mock('@/db', () => ({
    db: {
        playlists: {
            toArray: async () => [...rows.values()].map((row) => structuredClone(row)),
            add: async (row: Playlist) => void rows.set(row.id, structuredClone(row)),
            put: async (row: Playlist) => void rows.set(row.id, structuredClone(row)),
            delete: async (id: string) => void rows.delete(id),
            clear: async () => rows.clear(),
        },
    },
}));

const { usePlaylistsStore } = await import('./playlists');
const { passageKey } = await import('@/utils/bibelPassage');

const ROEMER = { slug: 'roemer', chapter: 8, verse: 28 };
const PSALM = { slug: 'psalm', chapter: 23 };
const CREATED = new Date(2026, 0, 1);

// A playlist as versions before the Bibel tab stored it.
const OLD: Playlist = {
    id: 'p',
    name: 'Erntedank',
    emoji: '🌾',
    songIds: ['a', 'b'],
    createdAt: CREATED,
    updatedAt: CREATED,
};

async function loadedStore() {
    const store = usePlaylistsStore();
    await store.loadPlaylists();
    return store;
}

describe('usePlaylistsStore — Bibelstellen', () => {
    beforeEach(() => {
        rows.clear();
        rows.set(OLD.id, structuredClone(OLD));
        setActivePinia(createPinia());
    });

    it('loads an old playlist and keeps writing it without passages', async () => {
        const store = await loadedStore();
        expect(store.getPlaylistById('p')?.passagen).toBeUndefined();

        await store.addSongToPlaylist('p', 'c');
        expect(rows.get('p')?.songIds).toEqual(['a', 'b', 'c']);
        expect('passagen' in rows.get('p')!).toBe(false);
    });

    it('adds a passage once, beside the songs', async () => {
        const store = await loadedStore();

        await store.addPassageToPlaylist('p', ROEMER);
        await store.addPassageToPlaylist('p', { ...ROEMER });
        await store.addPassagesToPlaylist('p', [PSALM, ROEMER]);

        expect(rows.get('p')?.passagen).toEqual([ROEMER, PSALM]);
        expect(rows.get('p')?.songIds).toEqual(['a', 'b']);
    });

    it('keeps its passages through every other write', async () => {
        const store = await loadedStore();
        await store.addPassageToPlaylist('p', PSALM);

        // Each of these writes a copy of the reactive record back.
        await store.updatePlaylist('p', { name: 'Ernte' });
        await store.removeSongFromPlaylist('p', 'a');
        await store.reorderSongs('p', ['b']);

        expect(rows.get('p')).toMatchObject({ name: 'Ernte', songIds: ['b'], passagen: [PSALM] });
    });

    it('reorders and removes by key', async () => {
        const store = await loadedStore();
        await store.addPassagesToPlaylist('p', [ROEMER, PSALM]);

        await store.reorderPlaylistPassages('p', [passageKey(PSALM), passageKey(ROEMER)]);
        expect(rows.get('p')?.passagen).toEqual([PSALM, ROEMER]);

        await store.removePassageFromPlaylist('p', passageKey(PSALM));
        expect(store.getPlaylistById('p')?.passagen).toEqual([ROEMER]);
    });
});
