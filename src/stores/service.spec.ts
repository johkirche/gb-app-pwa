import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for the two tables the store touches.
const services = new Map<string, unknown>();
const meta = new Map<string, unknown>();

vi.mock('@/db', () => ({
    db: {
        transaction: async (...args: unknown[]) => (args.at(-1) as () => Promise<void>)(),
        services: {
            get: async (id: string) => services.get(id),
            put: async (row: { id: string }) => void services.set(row.id, row),
            delete: async (id: string) => void services.delete(id),
            clear: async () => services.clear(),
            where: () => ({ below: () => ({ delete: async () => 0 }) }),
        },
        meta: {
            get: async (key: string) => meta.get(key),
            put: async (row: { key: string }) => void meta.set(row.key, row),
            delete: async (key: string) => void meta.delete(key),
        },
        playlists: { count: async () => 0, toArray: async () => [], get: async () => undefined },
    },
}));

const { useServiceStore } = await import('./service');
const { createPlan, endOfDay, todayIsoDate } = await import('@/services/servicePlans');
const { passageKey } = await import('@/utils/bibelPassage');

const ROEMER = { slug: 'roemer', chapter: 8, verse: 28, endVerse: 30 };
const PSALM = { slug: 'psalm', chapter: 23 };

describe('useServiceStore — Lesungen', () => {
    beforeEach(() => {
        services.clear();
        meta.clear();
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
        expect((services.get(store.plan!.id) as { lesungen: unknown }).lesungen).toEqual([ROEMER]);
    });

    it('keeps a passage once, and reorders and removes by key', async () => {
        const store = useServiceStore();
        await store.initPromise;

        await store.addLesung(ROEMER);
        await store.addLesung(PSALM);
        await store.addLesung({ ...ROEMER });
        expect(store.lesungen).toEqual([ROEMER, PSALM]);

        await store.reorderLesungen([passageKey(PSALM), passageKey(ROEMER)]);
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

    it('loads a plan stored before the Lesungen existed', async () => {
        const stored = createPlan({ title: 'Gottesdienst', entries: [{ songId: 'a' }] });
        // As an older version wrote it: no lesungen field at all.
        expect('lesungen' in stored).toBe(false);
        stored.expiresAt = endOfDay(stored.date);
        services.set(stored.id, stored);
        meta.set('service.activeId', { key: 'service.activeId', value: stored.id });

        const store = useServiceStore();
        await store.initPromise;

        expect(store.songIds).toEqual(['a']);
        expect(store.lesungen).toEqual([]);
        expect(store.selectionLabel).toBe('1 Lied · Heute');

        await store.addLesung(PSALM);
        expect(store.songIds).toEqual(['a']);
        expect(store.lesungen).toEqual([PSALM]);
    });
});
