import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import type { Lesezeichen, UserListEntry } from '@/db';
import { entryId, singletonListId } from '@/services/userData/ids';
import { currentOwnerId } from '@/services/userData/owner';
import { positionAfter } from '@/services/userData/positions';
import {
    deleteEntries,
    entriesOf,
    listsOfKind,
    newEntry,
    newList,
    onUserDataApplied,
    putEntries,
    putLists,
} from '@/services/userData/repo';
import { clearLastRead } from '@/utils/bibel';
import { passageToRef, refItemKey, refToPassage } from '@/utils/textRef';

/**
 * Lesezeichen in the Bible: verses the reader marked to come back to. The
 * account's one list of kind `bookmarks`, a verse per entry.
 */
export const useLesezeichenStore = defineStore('lesezeichen', () => {
    const lesezeichen = ref<Lesezeichen[]>([]);

    let listId: string | null = null;
    let entries: UserListEntry[] = [];

    const ids = computed(() => new Set(lesezeichen.value.map((l) => l.id)));
    // Newest first: the verse just marked is the one most likely wanted next.
    const sorted = computed(() =>
        [...lesezeichen.value].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    );

    function idOf(slug: string, chapter: number, verse: number): string {
        return `${slug}/${chapter}/${verse}`;
    }

    function toLesezeichen(entry: UserListEntry): Lesezeichen | null {
        if (entry.kind !== 'passage' || !entry.work || !entry.ref) return null;
        const passage = refToPassage({ work: entry.work, ref: entry.ref, refEnd: entry.refEnd });
        if (!passage?.verse) return null;
        return {
            id: idOf(passage.slug, passage.chapter, passage.verse),
            slug: passage.slug,
            chapter: passage.chapter,
            verse: passage.verse,
            // Kept on the device that set it; a Lesezeichen set on another
            // device arrives without, and the list names it by its reference.
            snippet: entry.snippet ?? '',
            createdAt: new Date(entry.createdAt),
        };
    }

    async function load() {
        try {
            const [list] = await listsOfKind('bookmarks');
            listId = list?.id ?? null;
            entries = list ? await entriesOf(list.id) : [];
            lesezeichen.value = entries
                .map(toLesezeichen)
                .filter((l): l is Lesezeichen => l !== null);
        } catch (err) {
            console.error('Error loading Lesezeichen:', err);
        }
    }

    async function ensureList(): Promise<string> {
        if (listId) return listId;
        const [list] = await listsOfKind('bookmarks');
        if (list) return (listId = list.id);
        const id = singletonListId(currentOwnerId(), 'bookmarks');
        await putLists([newList({ id, kind: 'bookmarks' })]);
        return (listId = id);
    }

    function has(slug: string, chapter: number, verse: number): boolean {
        return ids.value.has(idOf(slug, chapter, verse));
    }

    async function add(slug: string, chapter: number, verse: number, snippet: string) {
        const id = await ensureList();
        const ref = passageToRef({ slug, chapter, verse });
        await putEntries([
            newEntry({
                id: entryId(id, refItemKey(ref)),
                listId: id,
                kind: 'passage',
                position: positionAfter(entries.at(-1)?.position),
                ...ref,
                snippet,
            }),
        ]);
        await load();
    }

    /** By the Lesezeichen's id, `slug/chapter/verse`. */
    async function remove(id: string) {
        const removals = entries.filter((e) => {
            const l = toLesezeichen(e);
            return l?.id === id;
        });
        await deleteEntries(removals.map((e) => e.id));
        await load();
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
        await clearLastRead();
        listId = null;
        entries = [];
        lesezeichen.value = [];
    }

    onUserDataApplied(load);
    load();

    return { lesezeichen, sorted, has, toggle, add, remove, clearAll };
});
