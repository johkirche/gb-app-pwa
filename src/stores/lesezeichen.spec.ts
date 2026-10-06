import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for the two tables the store touches.
const rows = new Map<string, unknown>();
const meta = new Map<string, unknown>();

vi.mock('@/db', () => ({
    db: {
        lesezeichen: {
            toArray: async () => [...rows.values()],
            put: async (row: { id: string }) => void rows.set(row.id, row),
            delete: async (id: string) => void rows.delete(id),
            clear: async () => rows.clear(),
        },
        meta: {
            get: async (key: string) => meta.get(key),
            put: async (row: { key: string }) => void meta.set(row.key, row),
            delete: async (key: string) => void meta.delete(key),
        },
    },
}));

const { useLesezeichenStore } = await import('./lesezeichen');

describe('useLesezeichenStore', () => {
    beforeEach(() => {
        rows.clear();
        meta.clear();
        setActivePinia(createPinia());
    });

    it('sets a mark on a verse, and takes it off again', async () => {
        const store = useLesezeichenStore();

        expect(await store.toggle('psalm', 23, 4, 'Müßt’ ich auch wandern …')).toBe(true);
        expect(store.has('psalm', 23, 4)).toBe(true);
        expect(rows.has('psalm/23/4')).toBe(true);

        expect(await store.toggle('psalm', 23, 4, '')).toBe(false);
        expect(store.has('psalm', 23, 4)).toBe(false);
        expect(rows.size).toBe(0);
    });

    it('lists the newest mark first', async () => {
        const store = useLesezeichenStore();
        vi.useFakeTimers();
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
        meta.set('bibel.lastRead', { key: 'bibel.lastRead', value: 'psalm/23' });

        await store.clearAll();

        expect(store.sorted).toEqual([]);
        expect(rows.size).toBe(0);
        expect(meta.has('bibel.lastRead')).toBe(false);
    });
});
