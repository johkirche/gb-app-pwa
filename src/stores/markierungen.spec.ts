import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRegisteredUserState } from '@/services/userStateReset';

// An in-memory stand-in for the table the store touches.
const rows = new Map<string, unknown>();

vi.mock('@/db', () => ({
    db: {
        markierungen: {
            toArray: async () => [...rows.values()],
            bulkPut: async (list: { id: string }[]) => list.forEach((row) => rows.set(row.id, row)),
            bulkDelete: async (ids: string[]) => ids.forEach((id) => rows.delete(id)),
            delete: async (id: string) => void rows.delete(id),
            clear: async () => rows.clear(),
        },
    },
}));

const { useMarkierungenStore } = await import('./markierungen');

describe('useMarkierungenStore', () => {
    beforeEach(() => {
        rows.clear();
        setActivePinia(createPinia());
    });

    it('colours a passage, recolours it, and takes the colour off', async () => {
        const store = useMarkierungenStore();

        await store.setColor('psalm', 23, [1, 2], 'gelb');
        expect(store.colorOf('psalm', 23, 1)).toBe('gelb');
        expect(store.colorOf('psalm', 23, 2)).toBe('gelb');
        expect(rows.size).toBe(2);

        await store.setColor('psalm', 23, [2], 'blau');
        expect(store.colorOf('psalm', 23, 2)).toBe('blau');
        expect(store.markierungen).toHaveLength(2);

        await store.setColor('psalm', 23, [1, 2], null);
        expect(store.colorOf('psalm', 23, 1)).toBeUndefined();
        expect(rows.size).toBe(0);
    });

    it('lists the newest first', async () => {
        const store = useMarkierungenStore();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-01'));
        await store.setColor('johannes', 3, [16], 'rosa');
        vi.setSystemTime(new Date('2026-10-02'));
        await store.setColor('psalm', 23, [1], 'gruen');
        vi.useRealTimers();

        expect(store.sorted.map((m) => m.id)).toEqual(['psalm/23/1', 'johannes/3/16']);
    });

    it('forgets everything on logout', async () => {
        const store = useMarkierungenStore();
        await store.setColor('psalm', 23, [1], 'gelb');

        await resetRegisteredUserState();

        expect(store.markierungen).toEqual([]);
        expect(rows.size).toBe(0);
    });
});
