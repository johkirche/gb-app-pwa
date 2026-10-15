import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import { type DirectusResponse, SONGS_QUERY, transformSong } from '@/api/songsQuery';
import type { Song } from '@/db';
import { directusClient } from '@/services/directus';
import { SESSION_ENDED_ERROR, handleApiError, isSessionEndedError } from '@/services/errorHandler';
import type { SongManifestEntry } from '@/utils/syncDiff';

/**
 * Songs API
 *
 * Handles GraphQL queries and data transformation for songs from Directus.
 */

/**
 * The set the app carries: every Lied the kleiner Kreis has passed as "Rein".
 * Every query below is scoped by it — a delta must be a delta of the same set,
 * or a song leaving the book would read as a song that never existed.
 */
const REIN_FILTER = { bewertungKleinerKreis: { bezeichner: { _eq: 'Rein' } } };

/**
 * One row per song: the timestamps of the three collections a Lied is spread
 * over, and the two files it points at. ~200 KB against the 1.2 MB of the full
 * query — cheap enough to fetch on every sync and decide from there.
 *
 * `date_updated` / `modified_on` are optional Directus system fields, so this
 * query can fail where the song query succeeds. Every caller must therefore be
 * able to go on without it.
 */
const MANIFEST_QUERY = `
    query Manifest($filter: gesangbuchlied_filter) { gesangbuchlied( filter: $filter limit: 5000 ) { id date_updated textId { date_updated } melodieId { date_updated } notentext_svg { id modified_on } notentext_mxml { id modified_on } } }
`;

/**
 * Two counts, ~100 bytes: how large the set is, and how much of it moved since
 * the newest timestamp the device holds. Enough for the "Updates verfügbar"
 * hint without pulling a manifest for it.
 */
const CHANGE_COUNT_QUERY = `
    query Counts($all: gesangbuchlied_filter, $changed: gesangbuchlied_filter) { total: gesangbuchlied_aggregated( filter: $all ) { count { id } } changed: gesangbuchlied_aggregated( filter: $changed ) { count { id } } }
`;

// Get current token from the user store.
//
// There is deliberately no static fallback token: the logged-in Directus session
// is the only source of authority. In dev-bypass mode there is no session, so this
// returns null and the request goes out unauthenticated (only already-downloaded
// songs remain browsable, which is the honest behaviour).
async function getCurrentToken(): Promise<string | null> {
    const userStore = useUserStore();

    const token = userStore.authData?.accessToken || null;
    if (!token) return null;

    // Refresh if access token is expired/near-expiry (store includes a buffer)
    if (userStore.isTokenExpired && userStore.authData?.refreshToken) {
        const refreshed = await refreshAuthToken();
        if (refreshed) {
            return userStore.authData?.accessToken || null;
        }
    }

    return token;
}

/**
 * Run a query against Directus with the session token, refreshing it once on a
 * 401 and retrying. Shared by every query in this module so the token dance
 * lives in one place.
 */
async function queryDirectus<T extends object>(
    query: string,
    variables?: Record<string, unknown>,
): Promise<T> {
    const token = await getCurrentToken();
    if (token) {
        await directusClient.setToken(token);
    }

    try {
        return await directusClient.query<T>(query, variables);
    } catch (error) {
        // Check for invalid credentials first (user account may be deleted)
        const handled = await handleApiError(error);
        if (handled) {
            throw new Error(SESSION_ENDED_ERROR, { cause: error });
        }

        // If unauthorized, try to refresh token and retry
        if (error instanceof Error && error.message.includes('401')) {
            const refreshed = await refreshAuthToken();
            if (refreshed) {
                const newToken = await getCurrentToken();
                if (newToken) {
                    await directusClient.setToken(newToken);
                }
                return await directusClient.query<T>(query, variables);
            }
        }

        throw error;
    }
}

// Fetch songs from Directus
export async function fetchSongs(): Promise<Song[]> {
    try {
        const response = await queryDirectus<DirectusResponse>(SONGS_QUERY, {
            filter: REIN_FILTER,
        });

        return response.gesangbuchlied.map((song) => transformSong(song));
    } catch (error) {
        if (isSessionEndedError(error)) throw error;

        console.error('Error fetching songs from Directus:', error);
        throw new Error('Failed to fetch songs from server', { cause: error });
    }
}

// Directus takes `id: { _in: [...] }` in one go, but a delta after a bulk edit
// can name every song in the book — chunked so the query stays a query.
const ID_CHUNK_SIZE = 250;

/** Fetch the full records of exactly these songs, in chunks. */
export async function fetchSongsByIds(ids: string[]): Promise<Song[]> {
    if (ids.length === 0) return [];

    const songs: Song[] = [];

    for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
        const chunk = ids.slice(i, i + ID_CHUNK_SIZE);

        try {
            const response = await queryDirectus<DirectusResponse>(SONGS_QUERY, {
                filter: { ...REIN_FILTER, id: { _in: chunk } },
            });
            songs.push(...response.gesangbuchlied.map((song) => transformSong(song)));
        } catch (error) {
            if (isSessionEndedError(error)) throw error;

            console.error('Error fetching songs from Directus:', error);
            throw new Error('Failed to fetch songs from server', { cause: error });
        }
    }

    return songs;
}

interface DirectusManifestEntry {
    id: string;
    date_updated: string | null;
    textId: { date_updated: string | null } | null;
    melodieId: { date_updated: string | null } | null;
    notentext_svg: { id: string; modified_on: string | null } | null;
    notentext_mxml: { id: string; modified_on: string | null } | null;
}

/**
 * The sync manifest: what the server holds, in timestamps and file ids.
 *
 * Returns null instead of throwing when the manifest cannot be had — the
 * fields it rests on are optional and their read permission for the app's role
 * is not guaranteed. A sync that cannot get one falls back to pulling the
 * records in full; it must never fail over a shortcut.
 */
export async function fetchSongManifest(): Promise<SongManifestEntry[] | null> {
    try {
        const response = await queryDirectus<{ gesangbuchlied: DirectusManifestEntry[] }>(
            MANIFEST_QUERY,
            { filter: REIN_FILTER },
        );

        return response.gesangbuchlied.map((entry) => ({
            id: entry.id,
            dateUpdated: entry.date_updated ?? null,
            textDateUpdated: entry.textId?.date_updated ?? null,
            melodieDateUpdated: entry.melodieId?.date_updated ?? null,
            files: [entry.notentext_svg, entry.notentext_mxml]
                .filter((file): file is { id: string; modified_on: string | null } => !!file)
                .map((file) => ({ id: file.id, modifiedOn: file.modified_on ?? null })),
        }));
    } catch (error) {
        if (isSessionEndedError(error)) throw error;

        console.warn('Sync manifest unavailable, falling back to a full pull:', error);
        return null;
    }
}

/**
 * How many songs the server offers, and how many of them moved after `since`.
 * null when no statement is possible (offline, or the timestamps are not
 * readable) — the caller must not read that as "nothing changed".
 */
export async function fetchChangeCounts(
    since: string | null,
): Promise<{ total: number; changed: number | null }> {
    const changedFilter = since
        ? {
              ...REIN_FILTER,
              _or: [
                  { date_updated: { _gt: since } },
                  { textId: { date_updated: { _gt: since } } },
                  { melodieId: { date_updated: { _gt: since } } },
              ],
          }
        : // Without a local timestamp there is nothing to count against; ask
          // for the impossible so the second count comes back empty and unused.
          { ...REIN_FILTER, id: { _null: true } };

    const response = await queryDirectus<{
        total: { count: { id: number } }[];
        changed: { count: { id: number } }[];
    }>(CHANGE_COUNT_QUERY, { all: REIN_FILTER, changed: changedFilter });

    return {
        total: response.total[0]?.count.id ?? 0,
        changed: since ? (response.changed[0]?.count.id ?? 0) : null,
    };
}

/**
 * The files a full sync has to bring down: the vector Notenbild and the
 * MusicXML behind the two melody views, nothing else.
 *
 * The raster images in `melodieId.noten` are deliberately NOT included. That
 * relation is a mixed bag (PDF, MP3, MP4 alongside the PNGs) and, now that the
 * Notenbild is rendered from `notentext_svg`, none of it is displayed — it would
 * only be downloaded to sit unused. Songs cached before this change still fall
 * back to their stored raster, and a missing blob is fetched on demand.
 */
function collectSyncFileIds(songs: Song[]): string[] {
    const fileIds = new Set<string>();

    songs.forEach((song) => {
        if (song.notentextSvg) {
            fileIds.add(song.notentextSvg.id);
        }
        if (song.notentextMxml) {
            fileIds.add(song.notentextMxml.id);
        }
    });

    return Array.from(fileIds);
}

// Fetch songs together with the file IDs a full sync needs
export async function fetchSongsWithFiles(): Promise<{
    songs: Song[];
    fileIds: string[];
}> {
    const songs = await fetchSongs();

    return {
        songs,
        fileIds: collectSyncFileIds(songs),
    };
}
