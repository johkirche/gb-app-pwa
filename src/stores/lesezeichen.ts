import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { type Lesezeichen, db } from '@/db';
import { clearLastRead } from '@/utils/bibel';

/** Lesezeichen in the Bible: verses the reader marked to come back to. */
export const useLesezeichenStore = defineStore('lesezeichen', () => {
    const lesezeichen = ref<Lesezeichen[]>([]);

    const ids = computed(() => new Set(lesezeichen.value.map((l) => l.id)));
    // Newest first: the verse just marked is the one most likely wanted next.
    const sorted = computed(() =>
        [...lesezeichen.value].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    );

    async function load() {
        try {
            lesezeichen.value = await db.lesezeichen.toArray();
        } catch (err) {
            console.error('Error loading Lesezeichen:', err);
        }
    }

    function idOf(slug: string, chapter: number, verse: number): string {
        return `${slug}/${chapter}/${verse}`;
    }

    function has(slug: string, chapter: number, verse: number): boolean {
        return ids.value.has(idOf(slug, chapter, verse));
    }

    async function add(slug: string, chapter: number, verse: number, snippet: string) {
        const entry: Lesezeichen = {
            id: idOf(slug, chapter, verse),
            slug,
            chapter,
            verse,
            snippet,
            createdAt: new Date(),
        };
        await db.lesezeichen.put(entry);
        lesezeichen.value = [...lesezeichen.value.filter((l) => l.id !== entry.id), entry];
    }

    async function remove(id: string) {
        await db.lesezeichen.delete(id);
        lesezeichen.value = lesezeichen.value.filter((l) => l.id !== id);
    }

    /** Set or clear the mark on a verse; true when it is now set. */
    async function toggle(
        slug: string,
        chapter: number,
        verse: number,
        snippet: string,
    ): Promise<boolean> {
        if (has(slug, chapter, verse)) {
            await remove(idOf(slug, chapter, verse));
            return false;
        }
        await add(slug, chapter, verse, snippet);
        return true;
    }

    // On logout: the marks and the reading position are this reader's alone.
    async function clearAll() {
        await db.lesezeichen.clear();
        await clearLastRead();
        lesezeichen.value = [];
    }

    load();

    return { lesezeichen, sorted, has, toggle, add, remove, clearAll };
});
