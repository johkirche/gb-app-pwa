import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import type { Autor, Category, NotenFile, Song } from '@/db';
import { directusClient } from '@/services/directus';
import { handleApiError } from '@/services/errorHandler';

/**
 * Songs API
 *
 * Handles GraphQL queries and data transformation for songs from Directus.
 */

// GraphQL response types (nested structure from Directus)
interface DirectusAutorEntity {
    vorname: string;
    nachname: string;
    geburtsjahr?: number | null;
    sterbejahr?: number | null;
    geburtsjahrePrefix?: string | null;
    sterbejahrPrefix?: string | null;
}

interface DirectusAutor {
    autorPrefix?: string | null;
    autorSuffix?: string | null;
    // Junction field on text_autor/melodie_autor. NOT selected in SONGS_QUERY
    // yet: whether GraphQL can expand it as an m2o relation is unverified
    // against the live schema — see the comment at SONGS_QUERY.
    ursprungsAutor?: DirectusAutorEntity | null;
    autor_id: DirectusAutorEntity;
}

interface DirectusNotenFile {
    directus_files_id: {
        filename_download: string;
        id: string;
    };
}

interface DirectusKategorie {
    kategorie_id: {
        id: number;
        name: string;
    };
}

interface DirectusStrophe {
    strophe: string;
    anmerkung: string | null;
    aenderungsvorschlag: string | null;
}

interface DirectusGesangbuchlied {
    id: string;
    titel: string;
    liednummer2026: number | null;
    copyright?: string | null;
    textAutorExtraSuffix?: string | null;
    melodieAutorExtraSuffix?: string | null;
    notentext_mxml: {
        id: string;
        filename_download: string;
    } | null;
    notentext_svg: {
        id: string;
        filename_download: string;
    } | null;
    textId: {
        copyright?: string | null;
        strophenEinzeln: DirectusStrophe[];
        autorId: DirectusAutor[];
    } | null;
    melodieId: {
        copyright?: string | null;
        autorId: DirectusAutor[];
        noten: DirectusNotenFile[];
    } | null;
    kategorieId: DirectusKategorie[];
}

interface DirectusResponse {
    gesangbuchlied: DirectusGesangbuchlied[];
}

// GraphQL query
//
// NOTE on ursprungsAutor: the junction collections text_autor/melodie_autor
// carry an ursprungsAutor field, but whether the live schema models it as an
// expandable m2o relation (allowing `ursprungsAutor { vorname … }`) or as a
// plain integer is unverified. Until that is confirmed against the live
// Directus instance, the nested selection is deliberately omitted and
// ursprungsAutorObj stays null — the formatter (src/utils/authorFormat.ts)
// already handles it and needs no change once the selection is re-added.
const SONGS_QUERY = `
    { gesangbuchlied( filter: { bewertungKleinerKreis: { bezeichner: { _eq: "Rein" } } } limit: 5000 ) { id titel liednummer2026 copyright textAutorExtraSuffix melodieAutorExtraSuffix notentext_mxml { id filename_download } notentext_svg { id filename_download } textId { copyright strophenEinzeln autorId { autorPrefix autorSuffix autor_id { vorname nachname geburtsjahr sterbejahr geburtsjahrePrefix sterbejahrPrefix } } } melodieId { copyright autorId { autorPrefix autorSuffix autor_id { vorname nachname geburtsjahr sterbejahr geburtsjahrePrefix sterbejahrPrefix } } noten { directus_files_id { filename_download id } } } kategorieId { kategorie_id { name id } } } }
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

// Merge junction row (autorPrefix/autorSuffix/ursprungsAutor) over the autor
// entity — mirrors the dashboard's junction-over-entity merge (store/app.js).
function mapAutor(a: DirectusAutor): Autor {
    return {
        vorname: a.autor_id?.vorname ?? '',
        nachname: a.autor_id?.nachname ?? '',
        geburtsjahr: a.autor_id?.geburtsjahr ?? null,
        sterbejahr: a.autor_id?.sterbejahr ?? null,
        geburtsjahrePrefix: a.autor_id?.geburtsjahrePrefix ?? null,
        sterbejahrPrefix: a.autor_id?.sterbejahrPrefix ?? null,
        autorPrefix: a.autorPrefix ?? null,
        autorSuffix: a.autorSuffix ?? null,
        // Stays null until the ursprungsAutor selection is added to SONGS_QUERY
        // (see the note above the query).
        ursprungsAutorObj: a.ursprungsAutor
            ? {
                  vorname: a.ursprungsAutor.vorname ?? '',
                  nachname: a.ursprungsAutor.nachname ?? '',
                  geburtsjahr: a.ursprungsAutor.geburtsjahr ?? null,
                  sterbejahr: a.ursprungsAutor.sterbejahr ?? null,
                  geburtsjahrePrefix: a.ursprungsAutor.geburtsjahrePrefix ?? null,
                  sterbejahrPrefix: a.ursprungsAutor.sterbejahrPrefix ?? null,
              }
            : null,
    };
}

// Transform nested Directus response to flat Song structure
function transformSong(directusSong: DirectusGesangbuchlied): Song {
    const textAutoren: Autor[] = directusSong.textId?.autorId?.map(mapAutor) || [];

    const melodieAutoren: Autor[] = directusSong.melodieId?.autorId?.map(mapAutor) || [];

    const noten: NotenFile[] =
        directusSong.melodieId?.noten?.map((n) => ({
            filename_download: n.directus_files_id.filename_download,
            id: n.directus_files_id.id,
        })) || [];

    const kategorien: Category[] =
        directusSong.kategorieId?.map((k) => ({
            name: k.kategorie_id.name,
            index: String(k.kategorie_id.id),
        })) || [];

    // Transform strophen - flatten the structure properly
    const strophen = (directusSong.textId?.strophenEinzeln || []).map((s, idx) => ({
        text: s.strophe, // The actual verse text from backend
        strophe: String(idx + 1), // Verse number
        anmerkung: s.anmerkung || null,
        aenderungsvorschlag: s.aenderungsvorschlag || null,
    }));

    const notentextMxml: NotenFile | null = directusSong.notentext_mxml
        ? {
              id: directusSong.notentext_mxml.id,
              filename_download: directusSong.notentext_mxml.filename_download,
          }
        : null;

    const notentextSvg: NotenFile | null = directusSong.notentext_svg
        ? {
              id: directusSong.notentext_svg.id,
              filename_download: directusSong.notentext_svg.filename_download,
          }
        : null;

    return {
        id: directusSong.id,
        index: directusSong.liednummer2026 ?? 0,
        titel: directusSong.titel,
        strophen,
        textAutoren,
        melodieAutoren,
        noten,
        notentextMxml,
        notentextSvg,
        kategorien,
        copyright: directusSong.copyright ?? null,
        textCopyright: directusSong.textId?.copyright ?? null,
        melodieCopyright: directusSong.melodieId?.copyright ?? null,
        textAutorExtraSuffix: directusSong.textAutorExtraSuffix ?? null,
        melodieAutorExtraSuffix: directusSong.melodieAutorExtraSuffix ?? null,
    };
}

// Fetch songs from Directus
export async function fetchSongs(): Promise<Song[]> {
    try {
        const token = await getCurrentToken();
        if (token) {
            await directusClient.setToken(token);
        }

        const response = await directusClient.query<DirectusResponse>(SONGS_QUERY);

        return response.gesangbuchlied.map((song) => transformSong(song));
    } catch (error) {
        // Check for invalid credentials first (user account may be deleted)
        const handled = await handleApiError(error);
        if (handled) {
            throw new Error('Invalid credentials - user logged out', { cause: error });
        }

        // If unauthorized, try to refresh token and retry
        if (error instanceof Error && error.message.includes('401')) {
            const refreshed = await refreshAuthToken();
            if (refreshed) {
                const newToken = await getCurrentToken();
                if (newToken) {
                    await directusClient.setToken(newToken);
                }
                const response = await directusClient.query<DirectusResponse>(SONGS_QUERY);
                return response.gesangbuchlied.map((song) => transformSong(song));
            }
        }
        console.error('Error fetching songs from Directus:', error);
        throw new Error('Failed to fetch songs from server', { cause: error });
    }
}

/**
 * Fetch the newest server-side content change of the synced collection.
 *
 * date_updated is an OPTIONAL Directus system field — it may not exist on
 * gesangbuchlied at all. This helper therefore swallows EVERY error and
 * returns null, so a missing field only disables the staleness hint and can
 * never break sync. Deliberately kept out of SONGS_QUERY for the same reason.
 */
export async function fetchLatestContentUpdate(): Promise<string | null> {
    try {
        const token = await getCurrentToken();
        if (token) {
            await directusClient.setToken(token);
        }

        const response = await directusClient.query<{
            gesangbuchlied: { date_updated: string | null }[];
        }>(
            '{ gesangbuchlied(filter: { bewertungKleinerKreis: { bezeichner: { _eq: "Rein" } } }, sort: ["-date_updated"], limit: 1) { date_updated } }',
        );

        return response.gesangbuchlied[0]?.date_updated ?? null;
    } catch {
        return null;
    }
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
