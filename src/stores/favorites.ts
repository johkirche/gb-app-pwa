import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import type { Favorite, UserListEntry } from '@/db';
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
import { songItemKeyOf } from '@/utils/textRef';

/**
 * The Favoriten: the account's one list of kind `favorites`, a song per entry.
 * Kept in the shape the views have always read — a song id and when it was
 * added — so nothing above the store had to change when it became a list.
 */
export const useFavoritesStore = defineStore('favorites', () => {
    const favorites = ref<Favorite[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // The list's id and its entries as stored, for writing back.
    let listId: string | null = null;
    let entries: UserListEntry[] = [];

    const favoriteIds = computed(() => new Set(favorites.value.map((f) => f.id)));
    const sortedFavorites = computed(() =>
        [...favorites.value].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    );

    async function loadFavorites() {
        try {
            error.value = null;
            isLoading.value = true;
            const [list] = await listsOfKind('favorites');
            listId = list?.id ?? null;
            entries = list
                ? (await entriesOf(list.id)).filter((e) => e.kind === 'song' && e.songId)
                : [];
            favorites.value = entries.map((e) => ({
                id: e.songId!,
                createdAt: new Date(e.createdAt),
            }));
            return favorites.value;
        } catch (err) {
            console.error('Error loading favorites from DB:', err);
            error.value = 'Failed to load favorites';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    /** The Favoriten list, made on the first favourite. */
    async function ensureList(): Promise<string> {
        if (listId) return listId;
        const [list] = await listsOfKind('favorites');
        if (list) return (listId = list.id);
        const id = singletonListId(currentOwnerId(), 'favorites');
        await putLists([newList({ id, kind: 'favorites' })]);
        return (listId = id);
    }

    function isFavorite(songId: string): boolean {
        return favoriteIds.value.has(songId);
    }

    async function addFavorite(songId: string): Promise<void> {
        await addFavorites([songId]);
    }

    /** Several at once, e.g. from an imported backup; the ones already there are skipped. */
    async function addFavorites(songIds: string[], createdAt?: Map<string, string>): Promise<void> {
        const fresh = [...new Set(songIds)].filter((id) => !favoriteIds.value.has(id));
        if (fresh.length === 0) return;
        const id = await ensureList();
        let last = entries.at(-1)?.position ?? null;
        const rows = fresh.map((songId) => {
            last = positionAfter(last);
            return newEntry({
                id: entryId(id, songItemKeyOf(songId)),
                listId: id,
                kind: 'song',
                position: last,
                songId,
                ...(createdAt?.has(songId) ? { createdAt: createdAt.get(songId) } : {}),
            });
        });
        await putEntries(rows);
        await loadFavorites();
    }

    async function removeFavorite(songId: string): Promise<void> {
        const ids = entries.filter((e) => e.songId === songId).map((e) => e.id);
        await deleteEntries(ids);
        await loadFavorites();
    }

    async function toggleFavorite(songId: string): Promise<boolean> {
        if (isFavorite(songId)) {
            await removeFavorite(songId);
            return false;
        }
        await addFavorite(songId);
        return true;
    }

    // On logout: clearUserScopedData empties the tables, this the memory.
    async function clearAll(): Promise<void> {
        listId = null;
        entries = [];
        favorites.value = [];
    }

    onUserDataApplied(loadFavorites);
    loadFavorites();

    return {
        favorites,
        isLoading,
        error,
        favoriteIds,
        sortedFavorites,
        loadFavorites,
        isFavorite,
        addFavorite,
        addFavorites,
        removeFavorite,
        toggleFavorite,
        clearAll,
    };
});
