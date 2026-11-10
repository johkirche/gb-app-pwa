import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import type { MarkColor, Markierung, MarkierungsFarbe, TextMark } from '@/db';
import { MARK_COLORS } from '@/db/legacyUserData';
import { liveMarks, onUserDataApplied, updateMarks } from '@/services/userData/repo';
import { registerUserStateReset } from '@/services/userStateReset';
import { BIBEL_WORK, verseMarkId } from '@/utils/textRef';

const FARBEN = Object.fromEntries(
    Object.entries(MARK_COLORS).map(([farbe, color]) => [color, farbe]),
) as Record<MarkColor, MarkierungsFarbe>;

/** A verse's place, from a mark's ref: null for a chapter or another work. */
export function verseOfMark(
    mark: TextMark,
): { slug: string; chapter: number; verse: number } | null {
    if (mark.work !== BIBEL_WORK) return null;
    const [slug, chapter, verse, ...rest] = mark.ref.split('/');
    if (!slug || rest.length || !/^\d+$/.test(chapter ?? '') || !/^\d+$/.test(verse ?? '')) {
        return null;
    }
    return { slug, chapter: Number(chapter), verse: Number(verse) };
}

/** Whether a mark has nothing left on it and can go. */
export function isEmptyMark(mark: Pick<TextMark, 'color' | 'note' | 'readAt'>): boolean {
    return !mark.color && !mark.note && !mark.readAt;
}

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
            const marks = await liveMarks(BIBEL_WORK);
            markierungen.value = marks.flatMap((mark) => {
                const place = verseOfMark(mark);
                if (!place || !mark.color || !FARBEN[mark.color]) return [];
                return [
                    {
                        id: idOf(place.slug, place.chapter, place.verse),
                        ...place,
                        color: FARBEN[mark.color],
                        createdAt: new Date(mark.createdAt),
                    },
                ];
            });
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
     * write, since the reader marks a passage, not a verse at a time. A note on
     * the same verse stays where it is.
     */
    async function setColor(
        slug: string,
        chapter: number,
        verses: readonly number[],
        color: MarkierungsFarbe | null,
    ) {
        const ids = verses.map((verse) => verseMarkId(slug, chapter, verse));
        await updateMarks(ids, (current, id) => {
            const next = {
                id,
                work: BIBEL_WORK,
                ref: id.slice(BIBEL_WORK.length + 1),
                note: current?.note ?? null,
                readAt: current?.readAt ?? null,
                color: color ? MARK_COLORS[color] : null,
                // A new colour on a marked verse counts from now, as it always did.
                ...(color && !current?.color ? { createdAt: new Date().toISOString() } : {}),
            };
            return isEmptyMark(next) ? null : next;
        });
        await load();
    }

    /** By the Markierung's id, `slug/chapter/verse`. */
    async function remove(id: string) {
        const [slug, chapter, verse] = id.split('/');
        await setColor(slug, Number(chapter), [Number(verse)], null);
    }

    function clearAll() {
        markierungen.value = [];
    }

    registerUserStateReset(clearAll);
    onUserDataApplied(load);
    load();

    return { markierungen, sorted, colorOf, setColor, remove, clearAll, load };
});
