import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

import { entryId, singletonListId } from '@/services/userData/ids';

/**
 * The version 11 upgrade, run for real: a database as version 10 left it is
 * opened by the app's own class, and what the reader had must come out the
 * other side as lists, entries and marks, every row waiting for its upload.
 */

const V10 = {
    songs: 'id, titel',
    files: 'id, filename',
    auth: 'id',
    users: 'id, email, role',
    playlists: 'id, name, createdAt',
    preferences: 'id',
    favorites: 'id, createdAt',
    meta: 'key',
    services: 'id, date, expiresAt',
    lesezeichen: 'id, createdAt',
    gelesen: 'id, slug, readAt',
    markierungen: 'id, slug, createdAt',
    notizen: 'id, slug, updatedAt',
    leseplaene: 'id',
};

const OWNER = '6c1f6f1e-9a0e-4b44-a7a3-7d1a8f2a9a10';
const D = (s: string) => new Date(s);

async function seedVersion10() {
    const old = new Dexie('GesangbuchDB');
    old.version(10).stores(V10);
    await old.open();
    await old.table('users').put({ id: OWNER, email: 'a@example.com', role: 'Gesangbuchnutzer' });
    await old.table('playlists').put({
        id: 'p1',
        name: 'Erntedank',
        emoji: '🌾',
        songIds: ['10', '11'],
        passagen: [{ slug: 'psalm', chapter: 23 }],
        createdAt: D('2026-09-01'),
        updatedAt: D('2026-09-02'),
    });
    await old.table('favorites').bulkPut([
        { id: '20', createdAt: D('2026-08-02') },
        { id: '21', createdAt: D('2026-08-01') },
    ]);
    await old.table('lesezeichen').put({
        id: 'johannes/3/16',
        slug: 'johannes',
        chapter: 3,
        verse: 16,
        snippet: 'Denn so sehr …',
        createdAt: D('2026-07-01'),
    });
    await old.table('services').put({
        id: 's1',
        title: 'Gottesdienst',
        date: '2026-11-08',
        entries: [
            { songId: '30', verses: [1, 3] },
            { songId: '31', note: 'Ausgang' },
        ],
        lesungen: [{ slug: 'roemer', chapter: 8, verse: 28, endVerse: 30 }],
        order: ['song:30', 'lesung:roemer/8/28/30', 'song:31'],
        expiresAt: 0,
        origin: null,
        createdAt: D('2026-11-01'),
        updatedAt: D('2026-11-01'),
    });
    await old.table('markierungen').put({
        id: 'psalm/23/1',
        slug: 'psalm',
        chapter: 23,
        verse: 1,
        color: 'gruen',
        createdAt: D('2026-06-01'),
    });
    await old.table('notizen').put({
        id: 'psalm/23/1',
        slug: 'psalm',
        chapter: 23,
        verse: 1,
        text: 'Taufspruch',
        updatedAt: D('2026-06-02'),
    });
    await old
        .table('gelesen')
        .put({ id: 'rut/1', slug: 'rut', chapter: 1, readAt: D('2026-05-01') });
    old.close();
}

describe('the version 11 upgrade', () => {
    it("turns the reader's data into lists, entries and marks", async () => {
        await seedVersion10();
        const { db } = await import('@/db');
        await db.open();

        const lists = await db.lists.toArray();
        expect(lists.map((l) => l.kind).sort()).toEqual([
            'bookmarks',
            'collection',
            'favorites',
            'service',
        ]);
        // Every row waits for the first sync.
        for (const table of [db.lists, db.listEntries, db.marks]) {
            expect(await table.where('dirty').equals(1).count()).toBe(await table.count());
        }

        // The account's Favoriten under the id every device derives for it.
        const favoritesId = singletonListId(OWNER, 'favorites');
        const favorites = await db.listEntries.where('listId').equals(favoritesId).toArray();
        expect(favorites.map((e) => e.songId).sort()).toEqual(['20', '21']);
        expect(favorites.find((e) => e.songId === '21')?.createdAt).toBe(
            '2026-08-01T00:00:00.000Z',
        );
        expect(favorites[0].id).toBe(entryId(favoritesId, `song:${favorites[0].songId}`));

        // The playlist: songs in order, the passage after them.
        const playlist = (await db.listEntries.where('listId').equals('p1').toArray()).sort(
            (a, b) => (a.position < b.position ? -1 : 1),
        );
        expect(playlist.map((e) => e.songId ?? e.ref)).toEqual(['10', '11', 'psalm/23']);

        // The Ablauf, songs and reading interleaved as it was ordered.
        const service = (await db.listEntries.where('listId').equals('s1').toArray()).sort(
            (a, b) => (a.position < b.position ? -1 : 1),
        );
        expect(service.map((e) => e.songId ?? `${e.ref}-${e.refEnd}`)).toEqual([
            '30',
            'roemer/8/28-roemer/8/30',
            '31',
        ]);
        expect(service[0].verses).toEqual([1, 3]);
        expect(service[2].note).toBe('Ausgang');
        expect(await db.lists.get('s1')).toMatchObject({
            name: 'Gottesdienst',
            date: '2026-11-08',
        });

        // The Lesezeichen keeps its opening words on the device.
        const bookmark = await db.listEntries
            .where('listId')
            .equals(singletonListId(OWNER, 'bookmarks'))
            .first();
        expect(bookmark).toMatchObject({ ref: 'johannes/3/16', snippet: 'Denn so sehr …' });

        // Colour and note of a verse in one mark; the chapter read in another.
        expect(await db.marks.get('bibel/psalm/23/1')).toMatchObject({
            color: 'green',
            note: 'Taufspruch',
            readAt: null,
        });
        expect(await db.marks.get('bibel/rut/1')).toMatchObject({
            readAt: '2026-05-01T00:00:00.000Z',
        });

        // The old tables are left as they were.
        expect(await db.playlists.count()).toBe(1);
    });
});
