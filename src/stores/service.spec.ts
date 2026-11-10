import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { type Synced, db } from '@/db';
import { resetDb } from '@/db/testing';
import { todayIsoDate } from '@/services/servicePlans';
import { passageKey } from '@/utils/bibelPassage';

import { useServiceStore } from './service';

const ROEMER = { slug: 'roemer', chapter: 8, verse: 28, endVerse: 30 };
const PSALM = { slug: 'psalm', chapter: 23 };

/** As a row arrives from the account: uploaded, nothing waiting. */
function settled(at: string): Synced {
    return { dirty: 0, deleted: 0, synced: 1, createdAt: at, updatedAt: at };
}

describe('useServiceStore — Lesungen', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    it('starts a plan for today with the first reading', async () => {
        const store = useServiceStore();
        await store.initPromise;

        await store.addLesung(ROEMER);

        expect(store.lesungen).toEqual([ROEMER]);
        expect(store.plan?.date).toBe(todayIsoDate());
        // A reading alone is something to show: the tab appears for it.
        expect(store.hasSelection).toBe(true);
        expect(store.selectionLabel).toBe('1 Lesung · Heute');

        // Stored as an Ablauf with the reading as a passage entry.
        expect(await db.lists.get(store.plan!.id)).toMatchObject({
            kind: 'service',
            status: 'private',
        });
        const entries = await db.listEntries.where('listId').equals(store.plan!.id).toArray();
        expect(entries).toEqual([
            expect.objectContaining({
                kind: 'passage',
                work: 'bibel',
                ref: 'roemer/8/28',
                refEnd: 'roemer/8/30',
            }),
        ]);
    });

    it('keeps a passage once, and reorders and removes by key', async () => {
        const store = useServiceStore();
        await store.initPromise;

        await store.addLesung(ROEMER);
        await store.addLesung(PSALM);
        await store.addLesung({ ...ROEMER });
        expect(store.lesungen).toEqual([ROEMER, PSALM]);

        await store.reorder([`lesung:${passageKey(PSALM)}`, `lesung:${passageKey(ROEMER)}`]);
        expect(store.lesungen).toEqual([PSALM, ROEMER]);

        await store.removeLesung(passageKey(PSALM));
        expect(store.lesungen).toEqual([ROEMER]);
    });

    it('leaves the songs alone', async () => {
        const store = useServiceStore();
        await store.initPromise;

        await store.addSong('a');
        await store.addLesung(PSALM);
        expect(store.songIds).toEqual(['a']);
        expect(store.selectionLabel).toBe('1 Lied · 1 Lesung · Heute');
    });

    it('picks up an Ablauf another device put on the account', async () => {
        const at = new Date().toISOString();
        await db.lists.put({
            id: 'from-the-laptop',
            kind: 'service',
            status: 'private',
            name: 'Gottesdienst',
            emoji: null,
            gemeinde: null,
            serviceType: null,
            date: todayIsoDate(),
            time: null,
            keep: false,
            ...settled(at),
        });
        await db.listEntries.put({
            id: 'e1',
            listId: 'from-the-laptop',
            position: 'a0',
            kind: 'song',
            songId: '211',
            work: null,
            ref: null,
            refEnd: null,
            linkedListId: null,
            verses: [1, 3],
            note: 'Eingangslied',
            official: false,
            ...settled(at),
        });

        const store = useServiceStore();
        await store.initPromise;

        expect(store.plan?.title).toBe('Gottesdienst');
        expect(store.entries).toEqual([{ songId: '211', verses: [1, 3], note: 'Eingangslied' }]);
    });

    it('drops an Ablauf whose day is over, unless it was kept', async () => {
        const at = new Date().toISOString();
        const list = (id: string, keep: boolean) => ({
            id,
            kind: 'service' as const,
            status: 'private' as const,
            name: id,
            emoji: null,
            gemeinde: null,
            serviceType: null,
            date: '2026-01-04',
            time: null,
            keep,
            ...settled(at),
        });
        await db.lists.bulkPut([list('last-sunday', false), list('kept', true)]);

        const store = useServiceStore();
        await store.initPromise;

        expect(store.plan).toBeNull();
        expect(await db.lists.get('last-sunday')).toMatchObject({ deleted: 1, dirty: 1 });
        expect(await db.lists.get('kept')).toMatchObject({ deleted: 0 });
    });
});

describe('useServiceStore — one order for songs and readings', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    const keys = (store: ReturnType<typeof useServiceStore>) => store.items.map((i) => i.key);
    const PSALM_KEY = `lesung:${passageKey(PSALM)}`;
    const ROEMER_KEY = `lesung:${passageKey(ROEMER)}`;

    it('lists songs before readings until it is reordered', async () => {
        const store = useServiceStore();
        await store.initPromise;

        await store.addLesung(PSALM);
        await store.addSong('a');
        await store.addSong('b');
        expect(keys(store)).toEqual(['song:a', 'song:b', PSALM_KEY]);
    });

    it('puts a reading between the songs and keeps both lists in step', async () => {
        const store = useServiceStore();
        await store.initPromise;

        await store.addSong('a');
        await store.addSong('b');
        await store.addLesung(PSALM);
        await store.addLesung(ROEMER);
        await store.reorder(['song:b', ROEMER_KEY, 'song:a', PSALM_KEY]);

        expect(keys(store)).toEqual(['song:b', ROEMER_KEY, 'song:a', PSALM_KEY]);
        // The song swipe and a saved playlist read the songs alone.
        expect(store.songIds).toEqual(['b', 'a']);
        expect(store.lesungen).toEqual([ROEMER, PSALM]);

        // It survives a reload.
        setActivePinia(createPinia());
        const reloaded = useServiceStore();
        await reloaded.initPromise;
        expect(keys(reloaded)).toEqual(['song:b', ROEMER_KEY, 'song:a', PSALM_KEY]);
    });

    it('moves only the entries that moved', async () => {
        const store = useServiceStore();
        await store.initPromise;
        await store.addSong('a');
        await store.addSong('b');
        await store.addSong('c');
        await db.listEntries.toCollection().modify({ dirty: 0 });

        await store.reorder(['song:a', 'song:c', 'song:b']);

        const changed = await db.listEntries.where('dirty').equals(1).toArray();
        expect(changed.map((e) => e.songId).sort()).toEqual(['b', 'c']);
    });

    it('adds at the end and forgets what was removed', async () => {
        const store = useServiceStore();
        await store.initPromise;

        await store.addSong('a');
        await store.addLesung(PSALM);
        await store.reorder([PSALM_KEY, 'song:a']);

        await store.addSong('b');
        expect(keys(store)).toEqual([PSALM_KEY, 'song:a', 'song:b']);

        await store.removeSong('a');
        await store.removeLesung(passageKey(PSALM));
        expect(keys(store)).toEqual(['song:b']);

        // Marked again, a song comes back at the end, not where it once stood.
        await store.addSong('a');
        expect(keys(store)).toEqual(['song:b', 'song:a']);
    });
});
