import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import type { Notiz } from '@/db';
import { liveMarks, onUserDataApplied, updateMarks } from '@/services/userData/repo';
import { registerUserStateReset } from '@/services/userStateReset';
import { BIBEL_WORK, verseMarkId } from '@/utils/textRef';

import { isEmptyMark, verseOfMark } from './markierungen';

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
            const marks = await liveMarks(BIBEL_WORK);
            notizen.value = marks.flatMap((mark) => {
                const place = verseOfMark(mark);
                if (!place || !mark.note) return [];
                return [
                    {
                        id: idOf(place.slug, place.chapter, place.verse),
                        ...place,
                        text: mark.note,
                        updatedAt: new Date(mark.updatedAt),
                    },
                ];
            });
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

    async function write(slug: string, chapter: number, verse: number, text: string | null) {
        const id = verseMarkId(slug, chapter, verse);
        await updateMarks([id], (current) => {
            const next = {
                id,
                work: BIBEL_WORK,
                ref: `${slug}/${chapter}/${verse}`,
                color: current?.color ?? null,
                readAt: current?.readAt ?? null,
                note: text,
            };
            return isEmptyMark(next) ? null : next;
        });
        await load();
    }

    /** By the Notiz's id, `slug/chapter/verse`. A colour on the verse stays. */
    async function remove(id: string) {
        const [slug, chapter, verse] = id.split('/');
        await write(slug, Number(chapter), Number(verse), null);
    }

    /** Keep a note on a verse. A note emptied of text is a note deleted. */
    async function save(slug: string, chapter: number, verse: number, text: string) {
        await write(slug, chapter, verse, text.trim() || null);
    }

    function clearAll() {
        notizen.value = [];
    }

    registerUserStateReset(clearAll);
    onUserDataApplied(load);
    load();

    return { notizen, sorted, get, has, save, remove, clearAll, load };
});
