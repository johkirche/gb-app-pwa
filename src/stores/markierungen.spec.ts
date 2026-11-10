import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetDb } from '@/db/testing';
import { resetRegisteredUserState } from '@/services/userStateReset';

import { useMarkierungenStore } from './markierungen';
import { useNotizenStore } from './notizen';

describe('useMarkierungenStore', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    it('colours a passage, recolours it, and takes the colour off', async () => {
        const store = useMarkierungenStore();

        await store.setColor('psalm', 23, [1, 2], 'gelb');
        expect(store.colorOf('psalm', 23, 1)).toBe('gelb');
        expect(store.colorOf('psalm', 23, 2)).toBe('gelb');
        expect(await db.marks.count()).toBe(2);

        await store.setColor('psalm', 23, [2], 'blau');
        expect(store.colorOf('psalm', 23, 2)).toBe('blau');
        expect(store.markierungen).toHaveLength(2);

        await store.setColor('psalm', 23, [1, 2], null);
        expect(store.colorOf('psalm', 23, 1)).toBeUndefined();
        // Never uploaded, so nothing is left to delete on the server either.
        expect(await db.marks.count()).toBe(0);
    });

    it('keeps the colour as the account keeps it, and marks it for the sync', async () => {
        const store = useMarkierungenStore();
        await store.setColor('johannes', 3, [16], 'rosa');

        expect(await db.marks.get('bibel/johannes/3/16')).toMatchObject({
            work: 'bibel',
            ref: 'johannes/3/16',
            color: 'pink',
            dirty: 1,
            synced: 0,
        });
    });

    it('leaves a note on the verse where it is', async () => {
        const store = useMarkierungenStore();
        const notizen = useNotizenStore();
        await notizen.save('psalm', 23, 4, 'Trost.');

        await store.setColor('psalm', 23, [4], 'gruen');
        await store.setColor('psalm', 23, [4], null);

        expect(await db.marks.get('bibel/psalm/23/4')).toMatchObject({
            color: null,
            note: 'Trost.',
        });
    });

    it('lists the newest first', async () => {
        const store = useMarkierungenStore();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-01'));
        await store.setColor('johannes', 3, [16], 'rosa');
        vi.setSystemTime(new Date('2026-10-02'));
        await store.setColor('psalm', 23, [1], 'gruen');
        vi.useRealTimers();

        expect(store.sorted.map((m) => m.id)).toEqual(['psalm/23/1', 'johannes/3/16']);
    });

    it('forgets what it holds in memory on logout', async () => {
        const store = useMarkierungenStore();
        await store.setColor('psalm', 23, [1], 'gelb');

        await resetRegisteredUserState();

        expect(store.markierungen).toEqual([]);
    });
});
