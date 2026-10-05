import { computed, readonly, ref, shallowRef } from 'vue';

import { BIBEL_BOOKS } from '@/utils/bibel';
import { readBookFile, runPool } from '@/utils/bibelOffline';
import { type IndexedVerse, indexBook } from '@/utils/bibelSearch';

/**
 * The search index over all verses: built once, on the first search of the
 * session, and kept in memory — about 31,000 verses, a few MB of text. Module
 * state, so leaving the search page and coming back does not rebuild it.
 *
 * A book that cannot be read (offline, never opened) is left out and tried
 * again on the next `build()`; the search says how many books it covered.
 */

const byBook = new Map<string, IndexedVerse[]>();
const indexedCount = ref(0);
const building = ref(false);
let pending: Promise<void> | null = null;

/** All indexed verses in canonical order. Replaced (not mutated) as books
 *  arrive, so the results follow the index while it grows. */
const verses = shallowRef<IndexedVerse[]>([]);

function flatten() {
    // Canonical order, whatever order the books arrived in.
    verses.value = BIBEL_BOOKS.flatMap((book) => byBook.get(book.slug) ?? []);
}

// A tick for the browser between books: each is indexed in a few
// milliseconds, but 66 of them back to back would hold the page for a while.
function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function build(): Promise<void> {
    if (pending) return pending;
    const todo = BIBEL_BOOKS.filter((book) => !byBook.has(book.slug));
    if (!todo.length) return Promise.resolve();

    building.value = true;
    pending = runPool(todo, 4, async (book) => {
        try {
            const chapters = await readBookFile(book.slug);
            await yieldToBrowser();
            byBook.set(book.slug, indexBook(book.slug, chapters));
            indexedCount.value = byBook.size;
            flatten();
        } catch {
            // Not on the device and no connection: searched without it.
        }
    }).finally(() => {
        building.value = false;
        pending = null;
    });
    return pending;
}

export function useBibelSearchIndex() {
    return {
        verses,
        indexedCount: readonly(indexedCount),
        building: readonly(building),
        complete: computed(() => indexedCount.value === BIBEL_BOOKS.length),
        build,
    };
}
