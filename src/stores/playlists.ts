import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { type Playlist, db } from '@/db';

export const usePlaylistsStore = defineStore('playlists', () => {
    // State
    const playlists = ref<Playlist[]>([]);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

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
            const allPlaylists = await db.playlists.toArray();
            playlists.value = allPlaylists;
            return allPlaylists;
        } catch (err) {
            console.error('Error loading playlists from DB:', err);
            error.value = 'Failed to load playlists from local database';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function createPlaylist(name: string, emoji: string = '🎵'): Promise<Playlist> {
        try {
            error.value = null;
            const now = new Date();
            const playlist: Playlist = {
                id: crypto.randomUUID(),
                name,
                emoji,
                songIds: [],
                createdAt: now,
                updatedAt: now,
            };

            await db.playlists.add(playlist);
            playlists.value.push(playlist);
            return playlist;
        } catch (err) {
            console.error('Error creating playlist:', err);
            error.value = 'Failed to create playlist';
            throw err;
        }
    }

    async function updatePlaylist(
        id: string,
        updates: Partial<Pick<Playlist, 'name' | 'emoji'>>,
    ): Promise<void> {
        try {
            error.value = null;
            const playlist = playlists.value.find((p) => p.id === id);
            if (!playlist) {
                throw new Error('Playlist not found');
            }

            const updatedPlaylist = {
                ...playlist,
                ...updates,
                updatedAt: new Date(),
            };

            await db.playlists.put(updatedPlaylist);

            const index = playlists.value.findIndex((p) => p.id === id);
            if (index !== -1) {
                playlists.value[index] = updatedPlaylist;
            }
        } catch (err) {
            console.error('Error updating playlist:', err);
            error.value = 'Failed to update playlist';
            throw err;
        }
    }

    async function deletePlaylist(id: string): Promise<void> {
        try {
            error.value = null;
            await db.playlists.delete(id);
            playlists.value = playlists.value.filter((p) => p.id !== id);
        } catch (err) {
            console.error('Error deleting playlist:', err);
            error.value = 'Failed to delete playlist';
            throw err;
        }
    }

    async function addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
        try {
            error.value = null;
            const playlist = playlists.value.find((p) => p.id === playlistId);
            if (!playlist) {
                throw new Error('Playlist not found');
            }

            // Don't add duplicates
            if (playlist.songIds.includes(songId)) {
                return;
            }

            const updatedPlaylist = {
                ...playlist,
                songIds: [...playlist.songIds, songId],
                updatedAt: new Date(),
            };

            await db.playlists.put(updatedPlaylist);

            const index = playlists.value.findIndex((p) => p.id === playlistId);
            if (index !== -1) {
                playlists.value[index] = updatedPlaylist;
            }
        } catch (err) {
            console.error('Error adding song to playlist:', err);
            error.value = 'Failed to add song to playlist';
            throw err;
        }
    }

    async function addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<void> {
        try {
            error.value = null;
            const playlist = playlists.value.find((p) => p.id === playlistId);
            if (!playlist) {
                throw new Error('Playlist not found');
            }

            // Filter out duplicates
            const newSongIds = songIds.filter((id) => !playlist.songIds.includes(id));
            if (newSongIds.length === 0) {
                return;
            }

            const updatedPlaylist = {
                ...playlist,
                songIds: [...playlist.songIds, ...newSongIds],
                updatedAt: new Date(),
            };

            await db.playlists.put(updatedPlaylist);

            const index = playlists.value.findIndex((p) => p.id === playlistId);
            if (index !== -1) {
                playlists.value[index] = updatedPlaylist;
            }
        } catch (err) {
            console.error('Error adding songs to playlist:', err);
            error.value = 'Failed to add songs to playlist';
            throw err;
        }
    }

    async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
        try {
            error.value = null;
            const playlist = playlists.value.find((p) => p.id === playlistId);
            if (!playlist) {
                throw new Error('Playlist not found');
            }

            const updatedPlaylist = {
                ...playlist,
                songIds: playlist.songIds.filter((id) => id !== songId),
                updatedAt: new Date(),
            };

            await db.playlists.put(updatedPlaylist);

            const index = playlists.value.findIndex((p) => p.id === playlistId);
            if (index !== -1) {
                playlists.value[index] = updatedPlaylist;
            }
        } catch (err) {
            console.error('Error removing song from playlist:', err);
            error.value = 'Failed to remove song from playlist';
            throw err;
        }
    }

    async function reorderSongs(playlistId: string, songIds: string[]): Promise<void> {
        try {
            error.value = null;
            const playlist = playlists.value.find((p) => p.id === playlistId);
            if (!playlist) {
                throw new Error('Playlist not found');
            }

            const updatedPlaylist = {
                ...playlist,
                songIds,
                updatedAt: new Date(),
            };

            await db.playlists.put(updatedPlaylist);

            const index = playlists.value.findIndex((p) => p.id === playlistId);
            if (index !== -1) {
                playlists.value[index] = updatedPlaylist;
            }
        } catch (err) {
            console.error('Error reordering songs:', err);
            error.value = 'Failed to reorder songs';
            throw err;
        }
    }

    function getPlaylistById(id: string): Playlist | undefined {
        return playlists.value.find((p) => p.id === id);
    }

    // Remove all playlists from Dexie and memory (used on logout — playlists are
    // user data and must not leak to the next account on a shared device).
    async function clearAll(): Promise<void> {
        await db.playlists.clear();
        playlists.value = [];
    }

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
        getPlaylistById,
        clearAll,
    };
});
