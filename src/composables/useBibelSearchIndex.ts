import { computed, reactive, shallowReactive } from 'vue';

import { storeToRefs } from 'pinia';

import { usePreferencesStore } from '@/stores/preferences';

import { BIBEL_BOOKS, type BibelTranslationId } from '@/utils/bibel';
import { readBookFile, runPool } from '@/utils/bibelOffline';
import { type IndexedVerse, indexBook } from '@/utils/bibelSearch';

/**
 * The search index over all verses: built once per translation, on the first
 * search of the session, and kept in memory — about 31,000 verses, a few MB
 * of text. Module state, so leaving the search page and coming back does not
 * rebuild it. The search reads the translation the reader reads.
 *
 * A book that cannot be read (offline, never opened) is left out and tried
 * again on the next `build()`; the search says how many books it covered.
 */

interface TranslationIndex {
    byBook: Map<string, IndexedVerse[]>;
    /** All indexed verses in canonical order. Replaced (not mutated) as books
     *  arrive, so the results follow the index while it grows. */
    verses: IndexedVerse[];
    indexedCount: number;
    building: boolean;
    pending: Promise<void> | null;
}

function emptyIndex(): TranslationIndex {
    return shallowReactive({
        byBook: new Map(),
        verses: [],
        indexedCount: 0,
        building: false,
        pending: null,
    });
}

const indexes = reactive<Record<BibelTranslationId, TranslationIndex>>({
    menge: emptyIndex(),
    luther1912: emptyIndex(),
});

function flatten(index: TranslationIndex) {
    // Canonical order, whatever order the books arrived in.
    index.verses = BIBEL_BOOKS.flatMap((book) => index.byBook.get(book.slug) ?? []);
}

// A tick for the browser between books: each is indexed in a few
// milliseconds, but 66 of them back to back would hold the page for a while.
function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function build(translation: BibelTranslationId): Promise<void> {
    const index = indexes[translation];
    if (index.pending) return index.pending;
    const todo = BIBEL_BOOKS.filter((book) => !index.byBook.has(book.slug));
    if (!todo.length) return Promise.resolve();

    index.building = true;
    index.pending = runPool(todo, 4, async (book) => {
        try {
            const chapters = await readBookFile(book.slug, translation);
            await yieldToBrowser();
            index.byBook.set(book.slug, indexBook(book.slug, chapters));
            index.indexedCount = index.byBook.size;
            flatten(index);
        } catch {
            // Not on the device and no connection: searched without it.
        }
    }).finally(() => {
        index.building = false;
        index.pending = null;
    });
    return index.pending;
}

export function useBibelSearchIndex() {
    const { bibelTranslation } = storeToRefs(usePreferencesStore());
    const index = computed(() => indexes[bibelTranslation.value]);
    return {
        translation: bibelTranslation,
        verses: computed(() => index.value.verses),
        indexedCount: computed(() => index.value.indexedCount),
        building: computed(() => index.value.building),
        complete: computed(() => index.value.indexedCount === BIBEL_BOOKS.length),
        build: () => build(bibelTranslation.value),
    };
}
