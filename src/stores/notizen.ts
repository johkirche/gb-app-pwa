import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { type Notiz, db } from '@/db';
import { registerUserStateReset } from '@/services/userStateReset';

/** The reader's own notes on verses of the Bible, one per verse. */
export const useNotizenStore = defineStore('notizen', () => {
    const notizen = ref<Notiz[]>([]);

    const byId = computed(() => new Map(notizen.value.map((n) => [n.id, n])));
    // Last edited first: a note just written is the one most likely looked for.
    const sorted = computed(() =>
        [...notizen.value].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    );

    async function load() {
        try {
            notizen.value = await db.notizen.toArray();
        } catch (err) {
            console.error('Error loading Notizen:', err);
        }
    }

    function idOf(slug: string, chapter: number, verse: number): string {
        return `${slug}/${chapter}/${verse}`;
    }

    function get(slug: string, chapter: number, verse: number): Notiz | undefined {
        return byId.value.get(idOf(slug, chapter, verse));
    }

    function has(slug: string, chapter: number, verse: number): boolean {
        return byId.value.has(idOf(slug, chapter, verse));
    }

    async function remove(id: string) {
        await db.notizen.delete(id);
        notizen.value = notizen.value.filter((n) => n.id !== id);
    }

    /** Keep a note on a verse. A note emptied of text is a note deleted. */
    async function save(slug: string, chapter: number, verse: number, text: string) {
        const id = idOf(slug, chapter, verse);
        const trimmed = text.trim();
        if (!trimmed) {
            await remove(id);
            return;
        }
        const entry: Notiz = { id, slug, chapter, verse, text: trimmed, updatedAt: new Date() };
        await db.notizen.put(entry);
        notizen.value = [...notizen.value.filter((n) => n.id !== id), entry];
    }

    // On logout: clearUserScopedData empties the table, this the memory.
    async function clearAll() {
        await db.notizen.clear();
        notizen.value = [];
    }

    registerUserStateReset(clearAll);
    load();

    return { notizen, sorted, get, has, save, remove, clearAll };
});
