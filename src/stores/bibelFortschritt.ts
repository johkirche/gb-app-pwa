import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { type GelesenesKapitel, db } from '@/db';
import { registerUserStateReset } from '@/services/userStateReset';
import { BIBEL_BOOKS, type ChapterRef, findBook } from '@/utils/bibel';

export interface Fortschritt {
    read: number;
    total: number;
}

type Listener = (ref: ChapterRef) => void;

const TOTALS = {
    AT: BIBEL_BOOKS.filter((b) => b.testament === 'AT').reduce((n, b) => n + b.chapters, 0),
    NT: BIBEL_BOOKS.filter((b) => b.testament === 'NT').reduce((n, b) => n + b.chapters, 0),
};

/** Which chapters of the Bible the reader has marked as read. */
export const useBibelFortschrittStore = defineStore('bibelFortschritt', () => {
    // Keyed by `slug/chapter`, as the table is.
    const gelesen = ref(new Map<string, GelesenesKapitel>());

    // Told whenever a chapter is marked read, wherever that happened: the
    // reading plans tick off a day through this, without every place that can
    // mark a chapter having to know about plans.
    const listeners = new Set<Listener>();

    function idOf(slug: string, chapter: number): string {
        return `${slug}/${chapter}`;
    }

    // A row for a book or chapter the app no longer has (an older build of the
    // index) is kept in the table but never counted.
    function counts(entry: GelesenesKapitel): boolean {
        const book = findBook(entry.slug);
        return !!book && entry.chapter >= 1 && entry.chapter <= book.chapters;
    }

    async function load() {
        try {
            const rows = await db.gelesen.toArray();
            // Merged under what is in memory: a chapter marked while the table
            // was still being read must not be lost to the older snapshot.
            gelesen.value = new Map([
                ...rows.map((row) => [row.id, row] as const),
                ...gelesen.value,
            ]);
        } catch (err) {
            console.error('Error loading the chapters read:', err);
        }
    }

    function isRead(slug: string, chapter: number): boolean {
        return gelesen.value.has(idOf(slug, chapter));
    }

    function readAt(slug: string, chapter: number): Date | null {
        return gelesen.value.get(idOf(slug, chapter))?.readAt ?? null;
    }

    /**
     * Mark a chapter read. Marking it again moves its date to now: a chapter
     * read a second time, in a new reading plan, counts for that plan.
     */
    async function markRead(slug: string, chapter: number) {
        if (!findBook(slug)) return;
        const entry: GelesenesKapitel = {
            id: idOf(slug, chapter),
            slug,
            chapter,
            readAt: new Date(),
        };
        await db.gelesen.put(entry);
        const next = new Map(gelesen.value);
        next.set(entry.id, entry);
        gelesen.value = next;
        for (const listener of listeners) {
            try {
                listener({ slug, chapter });
            } catch (err) {
                console.error('Error after marking a chapter read:', err);
            }
        }
    }

    async function unmarkRead(slug: string, chapter: number) {
        const id = idOf(slug, chapter);
        await db.gelesen.delete(id);
        const next = new Map(gelesen.value);
        next.delete(id);
        gelesen.value = next;
    }

    /** Mark or unmark a chapter; true when it is now read. */
    async function toggle(slug: string, chapter: number): Promise<boolean> {
        if (isRead(slug, chapter)) {
            await unmarkRead(slug, chapter);
            return false;
        }
        await markRead(slug, chapter);
        return true;
    }

    function onMarkedRead(listener: Listener): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    const perBook = computed(() => {
        const result = new Map<string, number>();
        for (const entry of gelesen.value.values()) {
            if (counts(entry)) result.set(entry.slug, (result.get(entry.slug) ?? 0) + 1);
        }
        return result;
    });

    function bookProgress(slug: string): Fortschritt {
        return { read: perBook.value.get(slug) ?? 0, total: findBook(slug)?.chapters ?? 0 };
    }

    const perTestament = computed(() => {
        const read = { AT: 0, NT: 0 };
        for (const book of BIBEL_BOOKS) read[book.testament] += perBook.value.get(book.slug) ?? 0;
        return read;
    });

    function testamentProgress(testament: 'AT' | 'NT'): Fortschritt {
        return { read: perTestament.value[testament], total: TOTALS[testament] };
    }

    const overall = computed(() => {
        const read = perTestament.value.AT + perTestament.value.NT;
        const total = TOTALS.AT + TOTALS.NT;
        return { read, total, percent: Math.round((read / total) * 100) };
    });

    function reset() {
        gelesen.value = new Map();
    }

    registerUserStateReset(reset);
    load();

    return {
        isRead,
        readAt,
        markRead,
        unmarkRead,
        toggle,
        onMarkedRead,
        bookProgress,
        testamentProgress,
        overall,
        load,
    };
});
