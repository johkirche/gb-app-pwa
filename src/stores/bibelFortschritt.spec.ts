import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRegisteredUserState } from '@/services/userStateReset';

// An in-memory stand-in for the table the store touches.
const rows = new Map<string, { id: string; slug: string; chapter: number }>();

vi.mock('@/db', () => ({
    db: {
        gelesen: {
            toArray: async () => [...rows.values()],
            put: async (row: { id: string; slug: string; chapter: number }) =>
                void rows.set(row.id, row),
            delete: async (id: string) => void rows.delete(id),
        },
    },
}));

const { useBibelFortschrittStore } = await import('./bibelFortschritt');

describe('useBibelFortschrittStore', () => {
    beforeEach(() => {
        rows.clear();
        setActivePinia(createPinia());
    });

    it('marks a chapter read, and unmarks it again', async () => {
        const store = useBibelFortschrittStore();

        expect(await store.toggle('johannes', 3)).toBe(true);
        expect(store.isRead('johannes', 3)).toBe(true);
        expect(store.readAt('johannes', 3)).toBeInstanceOf(Date);
        expect(rows.has('johannes/3')).toBe(true);

        expect(await store.toggle('johannes', 3)).toBe(false);
        expect(store.isRead('johannes', 3)).toBe(false);
        expect(rows.size).toBe(0);
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
        rows.set('rut/1', { id: 'rut/1', slug: 'rut', chapter: 1 });
        rows.set('rut/9', { id: 'rut/9', slug: 'rut', chapter: 9 });
        rows.set('tobit/1', { id: 'tobit/1', slug: 'tobit', chapter: 1 });
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
