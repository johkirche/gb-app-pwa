import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db';
import { resetDb } from '@/db/testing';
import { passageKey } from '@/utils/bibelPassage';

import { usePlaylistsStore } from './playlists';

const ROEMER = { slug: 'roemer', chapter: 8, verse: 28 };
const PSALM = { slug: 'psalm', chapter: 23 };

async function loadedStore() {
    const store = usePlaylistsStore();
    await store.loadPlaylists();
    return store;
}

async function withSongs(...songIds: string[]) {
    const store = await loadedStore();
    const playlist = await store.createPlaylist('Erntedank', '🌾');
    await store.addSongsToPlaylist(playlist.id, songIds);
    return { store, id: playlist.id };
}

describe('usePlaylistsStore', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    it('keeps a playlist as a list with an entry per song', async () => {
        const { store, id } = await withSongs('a', 'b');

        expect(store.getPlaylistById(id)).toMatchObject({
            name: 'Erntedank',
            emoji: '🌾',
            songIds: ['a', 'b'],
        });
        expect(store.getPlaylistById(id)?.passagen).toBeUndefined();
        expect(await db.lists.get(id)).toMatchObject({ kind: 'collection', dirty: 1 });
        expect(await db.listEntries.where('listId').equals(id).count()).toBe(2);
    });

    it('adds a song once', async () => {
        const { store, id } = await withSongs('a', 'b');
        await store.addSongToPlaylist(id, 'a');
        await store.addSongToPlaylist(id, 'c');
        expect(store.getPlaylistById(id)?.songIds).toEqual(['a', 'b', 'c']);
    });

    it('adds a passage once, beside the songs', async () => {
        const { store, id } = await withSongs('a', 'b');

        await store.addPassageToPlaylist(id, ROEMER);
        await store.addPassageToPlaylist(id, { ...ROEMER });
        await store.addPassagesToPlaylist(id, [PSALM, ROEMER]);

        expect(store.getPlaylistById(id)?.passagen).toEqual([ROEMER, PSALM]);
        expect(store.getPlaylistById(id)?.songIds).toEqual(['a', 'b']);
    });

    it('keeps its passages through every other write', async () => {
        const { store, id } = await withSongs('a', 'b');
        await store.addPassageToPlaylist(id, PSALM);

        await store.updatePlaylist(id, { name: 'Ernte' });
        await store.removeSongFromPlaylist(id, 'a');
        await store.reorderSongs(id, ['b']);

        expect(store.getPlaylistById(id)).toMatchObject({
            name: 'Ernte',
            songIds: ['b'],
            passagen: [PSALM],
        });
    });

    it('reorders songs, writing only the ones that moved', async () => {
        const { store, id } = await withSongs('a', 'b', 'c');
        await db.listEntries.toCollection().modify({ dirty: 0 });

        await store.reorderSongs(id, ['a', 'c', 'b']);

        expect(store.getPlaylistById(id)?.songIds).toEqual(['a', 'c', 'b']);
        const changed = await db.listEntries.where('dirty').equals(1).toArray();
        expect(changed.map((e) => e.songId).sort()).toEqual(['b', 'c']);
    });

    it('reorders and removes passages by key', async () => {
        const { store, id } = await withSongs('a');
        await store.addPassagesToPlaylist(id, [ROEMER, PSALM]);

        await store.reorderPlaylistPassages(id, [passageKey(PSALM), passageKey(ROEMER)]);
        expect(store.getPlaylistById(id)?.passagen).toEqual([PSALM, ROEMER]);

        await store.removePassageFromPlaylist(id, passageKey(PSALM));
        expect(store.getPlaylistById(id)?.passagen).toEqual([ROEMER]);
    });

    it('imports a backup twice without doubling anything', async () => {
        const store = await loadedStore();
        const backup = {
            id: '0d0f5a52-4f0e-4c4e-9d35-2b6cbb0b4b5e',
            name: 'Advent',
            emoji: '🕯️',
            songIds: ['x', 'y'],
            passagen: [PSALM],
            createdAt: new Date('2025-12-01'),
            updatedAt: new Date('2025-12-01'),
        };

        await store.importPlaylists([backup]);
        await store.importPlaylists([backup]);

        expect(store.playlists).toHaveLength(1);
        expect(store.getPlaylistById(backup.id)).toMatchObject({
            songIds: ['x', 'y'],
            passagen: [PSALM],
        });
        expect(await db.listEntries.count()).toBe(3);
    });

    it('deletes a playlist with its entries', async () => {
        const { store, id } = await withSongs('a', 'b');
        await store.deletePlaylist(id);
        expect(store.playlists).toEqual([]);
        expect(await db.listEntries.count()).toBe(0);
    });
});
