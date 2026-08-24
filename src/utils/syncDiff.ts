/**
 * Sync-Diff
 *
 * What a sync actually has to fetch. A full pull is ~1.2 MB of song JSON and
 * ~87 MB of blobs; almost none of that changes between two syncs, so the sync
 * first asks the server for a *manifest* — one small row per song carrying the
 * server-side timestamps and the ids of its two files — and compares it against
 * what is already in IndexedDB.
 *
 * Everything here is pure: it takes a manifest and the local state and says
 * what to fetch, delete or keep. The store owns the IO, this owns the decision.
 */

/** A file as the manifest reports it. */
export interface ManifestFile {
    id: string;
    modifiedOn: string | null;
}

/**
 * One song as the manifest reports it.
 *
 * Three timestamps rather than one, because a Lied is spread over three
 * collections: `gesangbuchlied` does not move when only its Text or its Melodie
 * is edited. The junction tables (`text_autor`, `melodie_autor`) and
 * `kategorie` carry no timestamp at all — an edit there is only noticed because
 * saving it through the parent item bumps the parent's `date_updated`.
 */
export interface SongManifestEntry {
    id: string;
    dateUpdated: string | null;
    textDateUpdated: string | null;
    melodieDateUpdated: string | null;
    files: ManifestFile[];
}

/** The stored side of the comparison: a song row is enough of one. */
export interface LocalSongStamp {
    id: string;
    dateUpdated?: string | null;
    textDateUpdated?: string | null;
    melodieDateUpdated?: string | null;
}

/** Whatever carries file references — a stored `Song`, structurally. */
export interface FileBearingSong {
    notentextSvg?: { id: string } | null;
    notentextMxml?: { id: string } | null;
    noten?: { id: string }[];
}

export interface SongDiff {
    /** Songs whose record has to be pulled again. */
    changedIds: string[];
    /** Songs the server no longer offers — deleted, or no longer "Rein". */
    removedIds: string[];
}

export interface DiffOptions {
    /**
     * Ignore what is stored and treat everything as changed. The escape hatch
     * for a content version bump: when the set as a whole is declared stale,
     * no per-item timestamp can be trusted to say otherwise.
     */
    full?: boolean;
}

/** null and undefined are the same statement here: "no timestamp known". */
function sameStamp(a: string | null | undefined, b: string | null | undefined): boolean {
    return (a ?? null) === (b ?? null);
}

/**
 * Which songs need pulling, and which local ones are gone.
 *
 * A song stored before the timestamps were synced carries none, so it compares
 * unequal and is pulled once — 1.2 MB, and only the first time. This never
 * re-downloads a *file*: those are diffed separately, see `diffFiles`.
 */
export function diffSongs(
    manifest: SongManifestEntry[],
    local: LocalSongStamp[],
    options: DiffOptions = {},
): SongDiff {
    const localById = new Map(local.map((song) => [song.id, song]));
    const changedIds: string[] = [];

    for (const entry of manifest) {
        const stored = localById.get(entry.id);
        const unchanged =
            !options.full &&
            stored !== undefined &&
            sameStamp(stored.dateUpdated, entry.dateUpdated) &&
            sameStamp(stored.textDateUpdated, entry.textDateUpdated) &&
            sameStamp(stored.melodieDateUpdated, entry.melodieDateUpdated);

        if (!unchanged) changedIds.push(entry.id);
    }

    const manifestIds = new Set(manifest.map((entry) => entry.id));
    const removedIds = local.filter((song) => !manifestIds.has(song.id)).map((song) => song.id);

    return { changedIds, removedIds };
}

/** Every file the manifest asks a synced device to hold, de-duplicated. */
export function manifestFiles(manifest: SongManifestEntry[]): ManifestFile[] {
    const byId = new Map<string, ManifestFile>();
    for (const entry of manifest) {
        for (const file of entry.files) {
            if (!byId.has(file.id)) byId.set(file.id, file);
        }
    }
    return Array.from(byId.values());
}

/**
 * Which blobs to download.
 *
 * The id carries most of the answer: the notation pipeline uploads a *new*
 * Directus file per run rather than replacing one in place, so an id already
 * held is the same bytes. `modifiedOn` only guards the other case — a file
 * replaced in place through the Directus UI keeps its id. A local file without
 * a recorded stamp counts as current (blobs downloaded before stamps were
 * kept); `buildFileStamps` records one for it so the next sync can compare.
 */
export function diffFiles(
    manifest: SongManifestEntry[],
    presentIds: Set<string>,
    stamps: Record<string, string | null>,
    options: DiffOptions = {},
): string[] {
    return manifestFiles(manifest)
        .filter((file) => {
            if (options.full) return true;
            if (!presentIds.has(file.id)) return true;

            const stamp = stamps[file.id];
            if (stamp === undefined || stamp === null) return false;

            return stamp !== file.modifiedOn;
        })
        .map((file) => file.id);
}

/**
 * The stamp map to persist after a sync: what the server says, for the files
 * actually held. A file whose download failed is absent from `presentIds` and
 * so stays out of the map — the next sync sees it missing and retries.
 */
export function buildFileStamps(
    manifest: SongManifestEntry[],
    presentIds: Set<string>,
): Record<string, string | null> {
    const stamps: Record<string, string | null> = {};
    for (const file of manifestFiles(manifest)) {
        if (presentIds.has(file.id)) stamps[file.id] = file.modifiedOn;
    }
    return stamps;
}

/**
 * Every file id the local library still points at — including the raster
 * `noten`, which a sync never downloads but `getOrFetchFileBlob` may have
 * cached on demand, and which songs stored before the SVG existed fall back to.
 */
export function collectReferencedFileIds(songs: FileBearingSong[]): Set<string> {
    const ids = new Set<string>();
    for (const song of songs) {
        if (song.notentextSvg) ids.add(song.notentextSvg.id);
        if (song.notentextMxml) ids.add(song.notentextMxml.id);
        for (const file of song.noten ?? []) ids.add(file.id);
    }
    return ids;
}

/**
 * Blobs no song points at any more — the superseded uploads of a regenerated
 * notation, and the files of a song that left the book. Held against the local
 * songs rather than against the manifest, so an on-demand cached raster
 * survives.
 */
export function findOrphanFileIds(localFileIds: string[], songs: FileBearingSong[]): string[] {
    const referenced = collectReferencedFileIds(songs);
    return localFileIds.filter((id) => !referenced.has(id));
}

/**
 * Carry the manifest's timestamps onto freshly fetched songs.
 *
 * They are deliberately not selected in the song query itself: `date_updated`
 * is an optional Directus system field whose read permission for the app's role
 * is unverified. Asking for it there would put the whole sync at risk of a
 * permission error; asking for it in the manifest only risks the shortcut.
 */
export function stampSongs<T extends { id: string }>(
    songs: T[],
    manifest: SongManifestEntry[],
): (T & LocalSongStamp)[] {
    const byId = new Map(manifest.map((entry) => [entry.id, entry]));
    return songs.map((song) => {
        const entry = byId.get(song.id);
        return {
            ...song,
            dateUpdated: entry?.dateUpdated ?? null,
            textDateUpdated: entry?.textDateUpdated ?? null,
            melodieDateUpdated: entry?.melodieDateUpdated ?? null,
        };
    });
}

/**
 * The newest timestamp the library knows of, for the cheap "sind Updates
 * verfügbar?" check. null when nothing local carries one — then no statement
 * is possible.
 */
export function latestLocalStamp(local: LocalSongStamp[]): string | null {
    let latest: string | null = null;
    for (const song of local) {
        for (const stamp of [song.dateUpdated, song.textDateUpdated, song.melodieDateUpdated]) {
            if (stamp && (latest === null || stamp > latest)) latest = stamp;
        }
    }
    return latest;
}
