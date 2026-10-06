import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRegisteredUserState } from '@/services/userStateReset';

// An in-memory stand-in for the table the store touches.
const rows = new Map<string, unknown>();

vi.mock('@/db', () => ({
    db: {
        notizen: {
            toArray: async () => [...rows.values()],
            put: async (row: { id: string }) => void rows.set(row.id, row),
            delete: async (id: string) => void rows.delete(id),
            clear: async () => rows.clear(),
        },
    },
}));

const { useNotizenStore } = await import('./notizen');

describe('useNotizenStore', () => {
    beforeEach(() => {
        rows.clear();
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
        expect(rows.size).toBe(0);
    });

    it('lists the last edited first', async () => {
        const store = useNotizenStore();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-01'));
        await store.save('psalm', 23, 1, 'a');
        vi.setSystemTime(new Date('2026-10-02'));
        await store.save('johannes', 3, 16, 'b');
        vi.setSystemTime(new Date('2026-10-03'));
        await store.save('psalm', 23, 1, 'a, ergänzt');
        vi.useRealTimers();

        expect(store.sorted.map((n) => n.id)).toEqual(['psalm/23/1', 'johannes/3/16']);
    });

    it('forgets everything on logout', async () => {
        const store = useNotizenStore();
        await store.save('psalm', 23, 1, 'a');

        await resetRegisteredUserState();

        expect(store.notizen).toEqual([]);
        expect(rows.size).toBe(0);
    });
});
