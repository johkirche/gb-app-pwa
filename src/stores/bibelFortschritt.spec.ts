import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { type TextMark, db } from '@/db';
import { resetDb } from '@/db/testing';
import { resetRegisteredUserState } from '@/services/userStateReset';

import { useBibelFortschrittStore } from './bibelFortschritt';

function chapterRow(slug: string, chapter: number): TextMark {
    const at = new Date('2026-10-01').toISOString();
    return {
        id: `bibel/${slug}/${chapter}`,
        work: 'bibel',
        ref: `${slug}/${chapter}`,
        color: null,
        note: null,
        readAt: at,
        dirty: 0,
        deleted: 0,
        synced: 1,
        createdAt: at,
        updatedAt: at,
    };
}

describe('useBibelFortschrittStore', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    it('marks a chapter read, and unmarks it again', async () => {
        const store = useBibelFortschrittStore();

        expect(await store.toggle('johannes', 3)).toBe(true);
        expect(store.isRead('johannes', 3)).toBe(true);
        expect(store.readAt('johannes', 3)).toBeInstanceOf(Date);
        expect(await db.marks.get('bibel/johannes/3')).toMatchObject({ dirty: 1 });

        expect(await store.toggle('johannes', 3)).toBe(false);
        expect(store.isRead('johannes', 3)).toBe(false);
        expect(await db.marks.count()).toBe(0);
    });

    it('leaves a deletion for the sync where the account already has the chapter', async () => {
        await db.marks.put(chapterRow('rut', 1));
        const store = useBibelFortschrittStore();
        await store.load();

        await store.unmarkRead('rut', 1);

        expect(store.isRead('rut', 1)).toBe(false);
        expect(await db.marks.get('bibel/rut/1')).toMatchObject({ deleted: 1, dirty: 1 });
    });

    it('counts per book, per Testament and in all', async () => {
        const store = useBibelFortschrittStore();
        await store.markRead('rut', 1);
        await store.markRead('rut', 2);
        await store.markRead('judas', 1);

        expect(store.bookProgress('rut')).toEqual({ read: 2, total: 4 });
        expect(store.bookProgress('psalm')).toEqual({ read: 0, total: 150 });
        expect(store.testamentProgress('AT')).toEqual({ read: 2, total: 929 });
        expect(store.testamentProgress('NT')).toEqual({ read: 1, total: 260 });
        expect(store.overall).toEqual({ read: 3, total: 1189, percent: 0 });
    });

    it('counts a chapter marked twice once', async () => {
        const store = useBibelFortschrittStore();
        await store.markRead('rut', 1);
        await store.markRead('rut', 1);
        expect(store.bookProgress('rut').read).toBe(1);
    });

    it('reads what is already on the device, and skips chapters the Bible lacks', async () => {
        await db.marks.bulkPut([
            chapterRow('rut', 1),
            chapterRow('rut', 9),
            chapterRow('tobit', 1),
        ]);
        const store = useBibelFortschrittStore();
        await store.load();

        expect(store.isRead('rut', 1)).toBe(true);
        expect(store.bookProgress('rut').read).toBe(1);
        expect(store.overall.read).toBe(1);
    });

    it('tells listeners when a chapter is marked read, not when unmarked', async () => {
        const store = useBibelFortschrittStore();
        const heard: string[] = [];
        store.onMarkedRead((ref) => heard.push(`${ref.slug}/${ref.chapter}`));

        await store.markRead('psalm', 23);
        await store.unmarkRead('psalm', 23);

        expect(heard).toEqual(['psalm/23']);
    });

    it('forgets what was read on logout', async () => {
        const store = useBibelFortschrittStore();
        await store.markRead('psalm', 23);
        await resetRegisteredUserState();
        expect(store.isRead('psalm', 23)).toBe(false);
        expect(store.overall.read).toBe(0);
    });
});
