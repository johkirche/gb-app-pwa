import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { type Markierung, type MarkierungsFarbe, db } from '@/db';
import { registerUserStateReset } from '@/services/userStateReset';

/** Highlighted verses in the Bible, one colour per verse. */
export const useMarkierungenStore = defineStore('markierungen', () => {
    const markierungen = ref<Markierung[]>([]);

    const byId = computed(() => new Map(markierungen.value.map((m) => [m.id, m])));
    const sorted = computed(() =>
        [...markierungen.value].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    );

    async function load() {
        try {
            markierungen.value = await db.markierungen.toArray();
        } catch (err) {
            console.error('Error loading Markierungen:', err);
        }
    }

    function idOf(slug: string, chapter: number, verse: number): string {
        return `${slug}/${chapter}/${verse}`;
    }

    function colorOf(slug: string, chapter: number, verse: number): MarkierungsFarbe | undefined {
        return byId.value.get(idOf(slug, chapter, verse))?.color;
    }

    /**
     * Give verses a colour, or take it off with null. Several verses go in one
     * write, since the reader marks a passage, not a verse at a time.
     */
    async function setColor(
        slug: string,
        chapter: number,
        verses: readonly number[],
        color: MarkierungsFarbe | null,
    ) {
        const ids = verses.map((verse) => idOf(slug, chapter, verse));
        if (color === null) {
            await db.markierungen.bulkDelete(ids);
            markierungen.value = markierungen.value.filter((m) => !ids.includes(m.id));
            return;
        }
        const createdAt = new Date();
        const entries: Markierung[] = verses.map((verse) => ({
            id: idOf(slug, chapter, verse),
            slug,
            chapter,
            verse,
            color,
            createdAt,
        }));
        await db.markierungen.bulkPut(entries);
        markierungen.value = [...markierungen.value.filter((m) => !ids.includes(m.id)), ...entries];
    }

    async function remove(id: string) {
        await db.markierungen.delete(id);
        markierungen.value = markierungen.value.filter((m) => m.id !== id);
    }

    // On logout: clearUserScopedData empties the table, this the memory.
    async function clearAll() {
        await db.markierungen.clear();
        markierungen.value = [];
    }

    registerUserStateReset(clearAll);
    load();

    return { markierungen, sorted, colorOf, setColor, remove, clearAll };
});
