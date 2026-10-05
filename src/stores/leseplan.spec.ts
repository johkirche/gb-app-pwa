import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRegisteredUserState } from '@/services/userStateReset';

// In-memory stand-ins for the two tables the stores touch.
const gelesen = new Map<string, { id: string }>();
const plaene = new Map<string, { id: string; startedOn: string; doneDays: number[] }>();

vi.mock('@/db', () => ({
    db: {
        gelesen: {
            toArray: async () => [...gelesen.values()],
            put: async (row: { id: string }) => void gelesen.set(row.id, row),
            delete: async (id: string) => void gelesen.delete(id),
        },
        leseplaene: {
            toArray: async () => [...plaene.values()],
            put: async (row: { id: string; startedOn: string; doneDays: number[] }) =>
                void plaene.set(row.id, structuredClone(row)),
            clear: async () => plaene.clear(),
        },
    },
}));

const { useLeseplanStore } = await import('./leseplan');
const { useBibelFortschrittStore } = await import('./bibelFortschritt');

async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useLeseplanStore', () => {
    beforeEach(() => {
        gelesen.clear();
        plaene.clear();
        setActivePinia(createPinia());
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 5, 9));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts a plan today, and replaces the one before', async () => {
        const store = useLeseplanStore();
        await store.start('nt-90');
        await store.start('psalmen-30');

        expect(store.active).toEqual({ id: 'psalmen-30', startedOn: '2026-10-05', doneDays: [] });
        expect([...plaene.keys()]).toEqual(['psalmen-30']);
        expect(store.status(new Date())?.day).toBe(1);
    });

    it('ignores a plan it does not know', async () => {
        const store = useLeseplanStore();
        await store.start('apokryphen-7');
        expect(store.active).toBeNull();
    });

    it('stops a plan', async () => {
        const store = useLeseplanStore();
        await store.start('psalmen-30');
        await store.stop();
        expect(store.active).toBeNull();
        expect(plaene.size).toBe(0);
    });

    it('ticks off today once all its chapters are read', async () => {
        const store = useLeseplanStore();
        const fortschritt = useBibelFortschrittStore();
        await store.start('psalmen-30');

        for (const n of [1, 2, 3, 4]) await fortschritt.markRead('psalm', n);
        await flush();
        expect(store.isDayDone(1)).toBe(false);

        await fortschritt.markRead('psalm', 5);
        await flush();
        expect(store.isDayDone(1)).toBe(true);
        expect(plaene.get('psalmen-30')?.doneDays).toEqual([1]);
    });

    it('does not count a chapter read before the plan began', async () => {
        const fortschritt = useBibelFortschrittStore();
        vi.setSystemTime(new Date(2026, 8, 1, 9));
        for (const n of [1, 2, 3, 4]) await fortschritt.markRead('psalm', n);

        vi.setSystemTime(new Date(2026, 9, 5, 9));
        const store = useLeseplanStore();
        await store.start('psalmen-30');
        expect(store.isReadForPlan({ slug: 'psalm', chapter: 1 })).toBe(false);

        await fortschritt.markRead('psalm', 5);
        await flush();
        expect(store.isDayDone(1)).toBe(false);

        // Read again, in the plan: now it counts.
        for (const n of [1, 2, 3, 4]) await fortschritt.markRead('psalm', n);
        await flush();
        expect(store.isDayDone(1)).toBe(true);
    });

    it('finds a missed day behind, and ticks it off when caught up', async () => {
        const store = useLeseplanStore();
        const fortschritt = useBibelFortschrittStore();
        await store.start('psalmen-30');
        vi.setSystemTime(new Date(2026, 9, 7, 9));

        expect(store.status(new Date())).toMatchObject({ day: 3, behind: [1, 2] });

        for (const n of [6, 7, 8, 9, 10]) await fortschritt.markRead('psalm', n);
        await flush();
        expect(store.status(new Date())).toMatchObject({ day: 3, behind: [1] });
    });

    it('can tick a day off and on by hand', async () => {
        const store = useLeseplanStore();
        await store.start('psalmen-30');
        await store.setDayDone(1, true);
        expect(store.isDayDone(1)).toBe(true);
        await store.setDayDone(1, false);
        expect(store.isDayDone(1)).toBe(false);
    });

    it('picks the plan back up from the device', async () => {
        plaene.set('nt-90', { id: 'nt-90', startedOn: '2026-10-01', doneDays: [1, 2] });
        const store = useLeseplanStore();
        await store.load();
        expect(store.definition?.name).toBe('Das Neue Testament in 90 Tagen');
        expect(store.status(new Date())).toMatchObject({ day: 5, done: 2, behind: [3, 4] });
        expect(store.chaptersOf(1)[0]).toEqual({ slug: 'matthaeus', chapter: 1 });
    });

    it('forgets the plan on logout', async () => {
        const store = useLeseplanStore();
        await store.start('psalmen-30');
        await resetRegisteredUserState();
        expect(store.active).toBeNull();
    });
});
