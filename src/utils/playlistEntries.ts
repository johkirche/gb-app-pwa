import type { Playlist, Song } from '@/db';
import { toPassages } from '@/utils/bibelPassage';

/**
 * A plain, structured-cloneable copy of a playlist. Dexie cannot store the
 * reactive proxies a playlist's arrays pick up in the store (DataCloneError),
 * so every write goes through here. `passagen` is copied only where the
 * playlist has the field: one stored before passages existed is written back
 * exactly as it was.
 */
export function toPlainPlaylist(playlist: Playlist): Playlist {
    const plain: Playlist = { ...playlist, songIds: [...playlist.songIds] };
    if (playlist.passagen) plain.passagen = toPassages(playlist.passagen);
    return plain;
}

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
