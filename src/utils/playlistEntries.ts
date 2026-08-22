import type { Song } from '@/db';

/**
 * One row of a playlist: the id as it is stored, and the song behind it — or
 * null when nothing in the local library answers to that id (a song withdrawn
 * from the book, or a playlist that arrived before the last sync did).
 */
export interface PlaylistEntry {
    id: string;
    song: Song | null;
}

/**
 * Resolve a playlist's stored ids against the library, keeping every one of
 * them.
 *
 * Dropping the ids that no longer resolve is what let the two playlist screens
 * disagree: the list counted what was stored, the detail page counted what it
 * could show. A row that says so keeps both counts honest and gives the reader
 * something to remove.
 */
export function resolvePlaylistEntries(songIds: string[], songs: Song[]): PlaylistEntry[] {
    const byId = new Map(songs.map((song) => [song.id, song]));
    return songIds.map((id) => ({ id, song: byId.get(id) ?? null }));
}
