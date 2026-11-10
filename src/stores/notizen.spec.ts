import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/db';
import { resetDb } from '@/db/testing';
import { resetRegisteredUserState } from '@/services/userStateReset';

import { useMarkierungenStore } from './markierungen';
import { useNotizenStore } from './notizen';

describe('useNotizenStore', () => {
    beforeEach(async () => {
        await resetDb();
        setActivePinia(createPinia());
    });

    it('keeps a note on a verse, and replaces it when edited', async () => {
        const store = useNotizenStore();

        await store.save('psalm', 23, 4, '  Taufspruch  ');
        expect(store.get('psalm', 23, 4)?.text).toBe('Taufspruch');
        expect(store.has('psalm', 23, 4)).toBe(true);

        await store.save('psalm', 23, 4, 'Taufspruch von Anna');
        expect(store.notizen).toHaveLength(1);
        expect(store.get('psalm', 23, 4)?.text).toBe('Taufspruch von Anna');
    });

    it('deletes a note saved empty', async () => {
        const store = useNotizenStore();
        await store.save('psalm', 23, 4, 'Taufspruch');

        await store.save('psalm', 23, 4, '   ');

        expect(store.has('psalm', 23, 4)).toBe(false);
        expect(await db.marks.count()).toBe(0);
    });

    it('keeps the colour on the verse when the note goes', async () => {
        const store = useNotizenStore();
        await useMarkierungenStore().setColor('psalm', 23, [4], 'gelb');
        await store.save('psalm', 23, 4, 'Taufspruch');

        await store.remove('psalm/23/4');

        expect(await db.marks.get('bibel/psalm/23/4')).toMatchObject({
            color: 'yellow',
            note: null,
        });
    });

    it('lists the last edited first', async () => {
        const store = useNotizenStore();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-01'));
        await store.save('psalm', 23, 1, 'a');
        vi.setSystemTime(new Date('2026-10-02'));
        await store.save('johannes', 3, 16, 'b');
        vi.setSystemTime(new Date('2026-10-03'));
        await store.save('psalm', 23, 1, 'a, ergänzt');
        vi.useRealTimers();

        expect(store.sorted.map((n) => n.id)).toEqual(['psalm/23/1', 'johannes/3/16']);
    });

    it('forgets what it holds in memory on logout', async () => {
        const store = useNotizenStore();
        await store.save('psalm', 23, 1, 'a');

        await resetRegisteredUserState();

        expect(store.notizen).toEqual([]);
    });
});
