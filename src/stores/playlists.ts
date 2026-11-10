import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import type { BibelPassage, Playlist, UserList, UserListEntry } from '@/db';
import { entryId } from '@/services/userData/ids';
import { assignPositions } from '@/services/userData/positions';
import {
    deleteEntries,
    deleteLists,
    entriesOfLists,
    fresh,
    listsOfKind,
    newEntry,
    newList,
    onUserDataApplied,
    putEntries,
    putLists,
} from '@/services/userData/repo';
import { passageKey, reorderPassages, toPassage, withPassage } from '@/utils/bibelPassage';
import { passageToRef, refItemKey, refToPassage, songItemKeyOf } from '@/utils/textRef';

/**
 * The reader's own lists (kind `collection`), as the views have always read
 * them: songs in their order, and the Bible passages beside them in theirs.
 * Each song and passage is an entry of its own, so two devices editing one
 * playlist only collide where they changed the same entry.
 */

function passageOf(entry: UserListEntry): BibelPassage | null {
    if (entry.kind !== 'passage' || !entry.work || !entry.ref) return null;
    return toPassage(refToPassage({ work: entry.work, ref: entry.ref, refEnd: entry.refEnd }));
}

function toPlaylist(list: UserList, entries: UserListEntry[]): Playlist {
    const songIds = entries.filter((e) => e.kind === 'song' && e.songId).map((e) => e.songId!);
    const passagen = entries.map(passageOf).filter((p): p is BibelPassage => p !== null);
    const touched = [list.updatedAt, ...entries.map((e) => e.updatedAt)].sort().at(-1)!;
    return {
        id: list.id,
        name: list.name ?? '',
        emoji: list.emoji ?? '🎵',
        songIds,
        // Only where there are any, as before: a playlist without passages
        // reads as one stored before they existed.
        ...(passagen.length ? { passagen } : {}),
        createdAt: new Date(list.createdAt),
        updatedAt: new Date(touched),
    };
}

export const usePlaylistsStore = defineStore('playlists', () => {
    // State
    const playlists = ref<Playlist[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // The rows behind them, for writing back.
    const rows = new Map<string, { list: UserList; entries: UserListEntry[] }>();

    // Getters
    const hasPlaylists = computed(() => playlists.value.length > 0);
    const sortedPlaylists = computed(() =>
        [...playlists.value].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    );

    // Actions
    async function loadPlaylists() {
        try {
            error.value = null;
            isLoading.value = true;
            const lists = await listsOfKind('collection');
            const entries = await entriesOfLists(lists.map((l) => l.id));
            rows.clear();
            for (const list of lists)
                rows.set(list.id, { list, entries: entries.get(list.id) ?? [] });
            playlists.value = lists.map((l) => toPlaylist(l, entries.get(l.id) ?? []));
            return playlists.value;
        } catch (err) {
            console.error('Error loading playlists from DB:', err);
            error.value = 'Failed to load playlists from local database';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    function stored(playlistId: string) {
        const found = rows.get(playlistId);
        if (!found) throw new Error('Playlist not found');
        return found;
    }

    /** Run a change, report it the way the views expect, and read the result back. */
    async function change(what: string, run: () => Promise<void>): Promise<void> {
        try {
            error.value = null;
            await run();
            await loadPlaylists();
        } catch (err) {
            console.error(`Error: ${what}`, err);
            error.value = `Failed to ${what}`;
            throw err;
        }
    }

    async function createPlaylist(name: string, emoji: string = '🎵'): Promise<Playlist> {
        const id = crypto.randomUUID();
        await change('create playlist', () =>
            putLists([newList({ id, kind: 'collection', name, emoji })]),
        );
        return getPlaylistById(id)!;
    }

    async function updatePlaylist(
        id: string,
        updates: Partial<Pick<Playlist, 'name' | 'emoji'>>,
    ): Promise<void> {
        await change('update playlist', async () => {
            const { list } = stored(id);
            await putLists([{ ...fresh(list), ...updates }]);
        });
    }

    async function deletePlaylist(id: string): Promise<void> {
        await change('delete playlist', () => deleteLists([id]));
    }

    /**
     * Put the playlist's songs or passages in `order` (entry ids, new ones with
     * their rows in `added`). The two kinds are shown apart, so each is ordered
     * among itself only. Only entries that moved, and the new ones, are written.
     */
    async function arrange(
        playlistId: string,
        kind: 'song' | 'passage',
        order: string[],
        added: Map<string, string | BibelPassage> = new Map(),
    ) {
        const same = (rows.get(playlistId)?.entries ?? []).filter((e) => e.kind === kind);
        const positions = assignPositions(order, new Map(same.map((e) => [e.id, e.position])));
        const byId = new Map(same.map((e) => [e.id, e]));
        const writes = order.flatMap((id) => {
            const position = positions.get(id)!;
            const current = byId.get(id);
            if (current)
                return current.position === position ? [] : [{ ...fresh(current), position }];
            const value = added.get(id);
            if (value === undefined) return [];
            return [
                kind === 'song'
                    ? newEntry({ id, listId: playlistId, kind, position, songId: value as string })
                    : newEntry({
                          id,
                          listId: playlistId,
                          kind,
                          position,
                          ...passageToRef(value as BibelPassage),
                      }),
            ];
        });
        await putEntries(writes);
    }

    function songEntryId(playlistId: string, songId: string): string {
        const existing = stored(playlistId).entries.find(
            (e) => e.kind === 'song' && e.songId === songId,
        );
        return existing?.id ?? entryId(playlistId, songItemKeyOf(songId));
    }

    async function addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
        await addSongsToPlaylist(playlistId, [songId]);
    }

    async function addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<void> {
        await change('add songs to playlist', async () => {
            const playlist = getPlaylistById(playlistId);
            if (!playlist) throw new Error('Playlist not found');
            // Don't add duplicates
            const newSongIds = [...new Set(songIds)].filter((id) => !playlist.songIds.includes(id));
            if (newSongIds.length === 0) return;
            const added = new Map(
                newSongIds.map((s) => [entryId(playlistId, songItemKeyOf(s)), s]),
            );
            const order = [
                ...playlist.songIds.map((s) => songEntryId(playlistId, s)),
                ...added.keys(),
            ];
            await arrange(playlistId, 'song', order, added);
        });
    }

    async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
        await change('remove song from playlist', async () => {
            const ids = stored(playlistId)
                .entries.filter((e) => e.kind === 'song' && e.songId === songId)
                .map((e) => e.id);
            await deleteEntries(ids);
        });
    }

    async function reorderSongs(playlistId: string, songIds: string[]): Promise<void> {
        await change('reorder songs', async () => {
            const known = getPlaylistById(playlistId)?.songIds ?? [];
            // Songs missing from the new order keep their place at the end.
            const order = [...new Set([...songIds.filter((s) => known.includes(s)), ...known])];
            await arrange(
                playlistId,
                'song',
                order.map((s) => songEntryId(playlistId, s)),
            );
        });
    }

    // --- Bible passages ---
    // Kept beside the songs rather than among their ids: songIds stays a list
    // of songs for everything that reads it (the service provider, the export,
    // the counts), and a playlist without passages stays as it always was.

    function passageEntryId(playlistId: string, passage: BibelPassage): string {
        const key = passageKey(passage);
        const existing = stored(playlistId).entries.find((e) => {
            const p = passageOf(e);
            return p !== null && passageKey(p) === key;
        });
        return existing?.id ?? entryId(playlistId, refItemKey(passageToRef(passage)));
    }

    async function savePassagen(playlistId: string, next: BibelPassage[]): Promise<void> {
        const current = getPlaylistById(playlistId)?.passagen ?? [];
        const keep = new Set(next.map(passageKey));
        const removals = stored(playlistId)
            .entries.filter((e) => {
                const p = passageOf(e);
                return p !== null && !keep.has(passageKey(p));
            })
            .map((e) => e.id);
        const known = new Set(current.map(passageKey));
        const added = new Map(
            next
                .filter((p) => !known.has(passageKey(p)))
                .map((p) => [passageEntryId(playlistId, p), p]),
        );
        await deleteEntries(removals);
        await arrange(
            playlistId,
            'passage',
            next.map((p) => passageEntryId(playlistId, p)),
            added,
        );
    }

    /** Append a passage, unless the playlist already has it. */
    async function addPassageToPlaylist(playlistId: string, passage: BibelPassage): Promise<void> {
        await addPassagesToPlaylist(playlistId, [passage]);
    }

    async function addPassagesToPlaylist(
        playlistId: string,
        passages: BibelPassage[],
    ): Promise<void> {
        if (passages.length === 0) return;
        await change('save the Bible passages', async () => {
            const current = getPlaylistById(playlistId)?.passagen;
            await savePassagen(playlistId, passages.reduce(withPassage, current ?? []));
        });
    }

    /** Take a passage off, by its passageKey. */
    async function removePassageFromPlaylist(playlistId: string, key: string): Promise<void> {
        await change('save the Bible passages', async () => {
            const current = getPlaylistById(playlistId)?.passagen ?? [];
            await savePassagen(
                playlistId,
                current.filter((p) => passageKey(p) !== key),
            );
        });
    }

    async function reorderPlaylistPassages(playlistId: string, keys: string[]): Promise<void> {
        await change('save the Bible passages', async () => {
            const current = getPlaylistById(playlistId)?.passagen;
            await savePassagen(playlistId, reorderPassages(current, keys));
        });
    }

    /**
     * Playlists from a backup file, each written whole under its own id: a
     * playlist already here takes the backup's songs and passages, so importing
     * the same file twice changes nothing the second time.
     */
    async function importPlaylists(imported: Playlist[]): Promise<void> {
        await change('import playlists', async () => {
            const existing = await entriesOfLists(imported.map((p) => p.id));
            for (const playlist of imported) {
                const songs = [...new Set(playlist.songIds)];
                const passages = playlist.passagen ?? [];
                const positions = assignPositions(
                    [...songs.map((s) => `s:${s}`), ...passages.map((p) => `p:${passageKey(p)}`)],
                    new Map(),
                );
                const entries = [
                    ...songs.map((songId) =>
                        newEntry({
                            id: entryId(playlist.id, songItemKeyOf(songId)),
                            listId: playlist.id,
                            kind: 'song',
                            position: positions.get(`s:${songId}`)!,
                            songId,
                        }),
                    ),
                    ...passages.map((passage) => {
                        const ref = passageToRef(passage);
                        return newEntry({
                            id: entryId(playlist.id, refItemKey(ref)),
                            listId: playlist.id,
                            kind: 'passage',
                            position: positions.get(`p:${passageKey(passage)}`)!,
                            ...ref,
                        });
                    }),
                ];
                const keep = new Set(entries.map((e) => e.id));
                await putLists([
                    newList({
                        id: playlist.id,
                        kind: 'collection',
                        name: playlist.name,
                        emoji: playlist.emoji,
                        createdAt: new Date(playlist.createdAt).toISOString(),
                    }),
                ]);
                await deleteEntries(
                    (existing.get(playlist.id) ?? [])
                        .map((e) => e.id)
                        .filter((id) => !keep.has(id)),
                );
                await putEntries(entries);
            }
        });
    }

    function getPlaylistById(id: string): Playlist | undefined {
        return playlists.value.find((p) => p.id === id);
    }

    // On logout: clearUserScopedData empties the tables, this the memory.
    async function clearAll(): Promise<void> {
        rows.clear();
        playlists.value = [];
    }

    onUserDataApplied(loadPlaylists);
    // Initialize on store creation
    loadPlaylists();

    return {
        // State
        playlists,
        isLoading,
        error,
        // Getters
        hasPlaylists,
        sortedPlaylists,
        // Actions
        loadPlaylists,
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        addSongToPlaylist,
        addSongsToPlaylist,
        removeSongFromPlaylist,
        reorderSongs,
        addPassageToPlaylist,
        addPassagesToPlaylist,
        removePassageFromPlaylist,
        reorderPlaylistPassages,
        importPlaylists,
        getPlaylistById,
        clearAll,
    };
});
