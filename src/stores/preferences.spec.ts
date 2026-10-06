import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for the one table the store touches.
const rows = new Map<string, Record<string, unknown>>();

vi.mock('@/db', () => ({
    db: {
        preferences: {
            get: async (id: string) => rows.get(id),
            put: async (row: { id: string }) => void rows.set(row.id, { ...row }),
            delete: async (id: string) => void rows.delete(id),
        },
    },
}));

const {
    DEFAULT_BIBEL_DISPLAY,
    DEFAULT_BIBEL_FEATURES,
    readBibelDisplay,
    readBibelFeatures,
    readBibelScale,
    readBibelTranslation,
    usePreferencesStore,
} = await import('./preferences');

describe('the Bible settings', () => {
    beforeEach(() => {
        rows.clear();
        setActivePinia(createPinia());
    });

    it('sizes the Bible like the songs until the reader sizes it on its own', async () => {
        rows.set('default', { id: 'default', pageScale: 1.4 });
        const store = usePreferencesStore();
        await store.initPromise;

        expect(store.bibelScale).toBe(1.4);
        await store.setPageScale(1.6);
        expect(store.bibelScale).toBe(1.6);

        await store.setBibelScale(0.8);
        expect(store.bibelScale).toBe(0.8);
        expect(rows.get('default')?.bibelScale).toBe(0.8);

        // The songs no longer pull it along.
        await store.setPageScale(1.2);
        expect(store.bibelScale).toBe(0.8);
    });

    it('keeps the Bible size within the slider', async () => {
        const store = usePreferencesStore();
        await store.initPromise;
        await store.setBibelScale(5);
        expect(store.bibelScale).toBe(2);
    });

    it('reads a stored Bible size back', async () => {
        rows.set('default', { id: 'default', pageScale: 1, bibelScale: 1.3 });
        const store = usePreferencesStore();
        await store.initPromise;
        expect(store.bibelScale).toBe(1.3);
    });

    it('stores a display switch and reads it back', async () => {
        const store = usePreferencesStore();
        await store.initPromise;
        await store.setBibelDisplay('versePerLine', true);

        setActivePinia(createPinia());
        const again = usePreferencesStore();
        await again.initPromise;
        expect(again.bibelDisplay).toEqual({ ...DEFAULT_BIBEL_DISPLAY, versePerLine: true });
    });

    it('reads Menge until the reader chooses Luther', async () => {
        const store = usePreferencesStore();
        await store.initPromise;
        expect(store.bibelTranslation).toBe('menge');

        await store.setBibelTranslation('luther1912');
        expect(rows.get('default')?.bibelTranslation).toBe('luther1912');

        setActivePinia(createPinia());
        const again = usePreferencesStore();
        await again.initPromise;
        expect(again.bibelTranslation).toBe('luther1912');
    });

    it('leaves the reading progress off until asked for', () => {
        expect(DEFAULT_BIBEL_FEATURES.fortschritt).toBe(false);
        expect(DEFAULT_BIBEL_FEATURES.lesezeichen).toBe(true);
    });

    it('stores only the switches the reader set, so a later default still applies', async () => {
        const store = usePreferencesStore();
        await store.initPromise;
        await store.setBibelFeature('notizen', false);
        expect(rows.get('default')?.bibelFeatures).toEqual({ notizen: false });
        expect(store.bibelFeatures.fortschritt).toBe(DEFAULT_BIBEL_FEATURES.fortschritt);
    });

    it('remembers a feature switched off', async () => {
        const store = usePreferencesStore();
        await store.initPromise;
        expect(store.bibelFeatures).toEqual(DEFAULT_BIBEL_FEATURES);

        await store.setBibelFeature('vorlesen', false);

        setActivePinia(createPinia());
        const again = usePreferencesStore();
        await again.initPromise;
        expect(again.bibelFeatures).toEqual({ ...DEFAULT_BIBEL_FEATURES, vorlesen: false });
    });

    it('reads a record from the side-by-side days as Menge', async () => {
        rows.set('default', { id: 'default', bibelParallel: 'luther1912' });
        const store = usePreferencesStore();
        await store.initPromise;
        expect(store.bibelTranslation).toBe('menge');
    });

    it('forgets the Bible settings on logout', async () => {
        const store = usePreferencesStore();
        await store.initPromise;
        await store.setBibelScale(1.5);
        await store.setBibelDisplay('showHeadings', false);
        await store.setBibelTranslation('luther1912');
        await store.setBibelFeature('notizen', false);

        await store.resetToDefaults();
        expect(store.bibelScale).toBe(1);
        expect(store.bibelDisplay).toEqual(DEFAULT_BIBEL_DISPLAY);
        expect(store.bibelTranslation).toBe('menge');
        expect(store.bibelFeatures).toEqual(DEFAULT_BIBEL_FEATURES);
    });
});

describe('readBibelDisplay', () => {
    it('gives the defaults for a record from before the setting', () => {
        expect(readBibelDisplay(undefined)).toEqual(DEFAULT_BIBEL_DISPLAY);
    });

    it('keeps what was stored and fills in the rest', () => {
        expect(readBibelDisplay({ notesInline: true })).toEqual({
            ...DEFAULT_BIBEL_DISPLAY,
            notesInline: true,
        });
    });

    it('takes only switches that are switches', () => {
        const stored = { showHeadings: 'no', extra: true } as unknown as Parameters<
            typeof readBibelDisplay
        >[0];
        expect(readBibelDisplay(stored)).toEqual(DEFAULT_BIBEL_DISPLAY);
    });
});

describe('readBibelScale', () => {
    it('is nothing while the reader has not sized the Bible', () => {
        expect(readBibelScale(undefined)).toBeNull();
        expect(readBibelScale(Number.NaN)).toBeNull();
    });

    it('keeps a stored size within the slider', () => {
        expect(readBibelScale(0.1)).toBe(0.5);
        expect(readBibelScale(1.2)).toBe(1.2);
    });
});

describe('readBibelTranslation', () => {
    it('is Menge for a record from before the setting', () => {
        expect(readBibelTranslation(undefined)).toBe('menge');
    });

    it('takes only a translation the app has', () => {
        expect(readBibelTranslation('luther1912')).toBe('luther1912');
        expect(readBibelTranslation('elberfelder' as unknown as 'luther1912')).toBe('menge');
    });
});

describe('readBibelFeatures', () => {
    it('keeps what was stored and fills in the rest', () => {
        expect(readBibelFeatures({ vorlesen: false })).toEqual({
            ...DEFAULT_BIBEL_FEATURES,
            vorlesen: false,
        });
    });

    it('takes only switches that are switches', () => {
        const stored = { lieder: 'aus' } as unknown as Parameters<typeof readBibelFeatures>[0];
        expect(readBibelFeatures(stored)).toEqual(DEFAULT_BIBEL_FEATURES);
    });
});
