import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetDb } from '@/db/testing';

import { useLesezeichenStore } from './lesezeichen';

describe('useLesezeichenStore', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    it('sets a mark on a verse, and takes it off again', async () => {
        const store = useLesezeichenStore();

        expect(await store.toggle('psalm', 23, 4, 'Müßt’ ich auch wandern …')).toBe(true);
        expect(store.has('psalm', 23, 4)).toBe(true);
        expect(store.sorted[0]).toMatchObject({
            id: 'psalm/23/4',
            snippet: 'Müßt’ ich auch wandern …',
        });

        expect(await store.toggle('psalm', 23, 4, '')).toBe(false);
        expect(store.has('psalm', 23, 4)).toBe(false);
        expect(await db.listEntries.count()).toBe(0);
    });

    it('keeps them in one list of kind bookmarks, a passage per entry', async () => {
        const store = useLesezeichenStore();
        await store.add('johannes', 3, 16, 'Denn so sehr …');
        await store.add('psalm', 23, 1, 'Ein Psalm von David.');

        const lists = await db.lists.toArray();
        expect(lists).toHaveLength(1);
        expect(lists[0].kind).toBe('bookmarks');
        const entries = await db.listEntries.where('listId').equals(lists[0].id).toArray();
        expect(entries.map((e) => [e.kind, e.work, e.ref])).toEqual(
            expect.arrayContaining([
                ['passage', 'bibel', 'johannes/3/16'],
                ['passage', 'bibel', 'psalm/23/1'],
            ]),
        );
    });

    it('lists the newest mark first', async () => {
        const store = useLesezeichenStore();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-01'));
        await store.add('johannes', 3, 16, 'Denn so sehr …');
        vi.setSystemTime(new Date('2026-10-02'));
        await store.add('psalm', 23, 1, 'Ein Psalm von David.');
        vi.useRealTimers();

        expect(store.sorted.map((mark) => mark.id)).toEqual(['psalm/23/1', 'johannes/3/16']);
    });

    it('forgets the marks and the reading position on logout', async () => {
        const store = useLesezeichenStore();
        await store.add('psalm', 23, 1, '');
        await db.meta.put({ key: 'bibel.lastRead', value: 'psalm/23' });

        await store.clearAll();

        expect(store.sorted).toEqual([]);
        expect(await db.meta.get('bibel.lastRead')).toBeUndefined();
    });
});
