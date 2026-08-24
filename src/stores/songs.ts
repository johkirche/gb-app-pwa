import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { fetchFile } from '@/api/files.api';
import {
    fetchChangeCounts,
    fetchSongManifest,
    fetchSongsByIds,
    fetchSongsWithFiles,
} from '@/api/songs.api';
import { type Song, db } from '@/db';
import { requestPersistentStorage } from '@/services/storage';
import {
    type SongManifestEntry,
    buildFileStamps,
    diffFiles,
    diffSongs,
    findOrphanFileIds,
    latestLocalStamp,
    stampSongs,
} from '@/utils/syncDiff';

// Dexie wraps the DOMException: sometimes the error itself carries the name,
// sometimes it lives on .inner — check both shapes.
function isQuotaExceeded(err: unknown): boolean {
    const e = err as { name?: string; inner?: { name?: string } } | null;
    return e?.name === 'QuotaExceededError' || e?.inner?.name === 'QuotaExceededError';
}

export const useSongsStore = defineStore('songs', () => {
    // State
    const songs = ref<Song[]>([]);
    const isLoading = ref(false);
    // Whether the first read from IndexedDB has finished. `isLoading` cannot
    // answer that on its own — it is false both before the read starts and
    // after it is done, so a screen that waits on it alone renders its empty
    // state in the gap.
    const isInitialized = ref(false);
    const isSyncing = ref(false);
    const error = ref<string | null>(null);
    const lastSyncTime = ref<Date | null>(null);
    const failedFiles = ref<{ id: string; filename: string }[]>([]);
    const syncProgress = ref({
        current: 0,
        total: 0,
        phase: '' as 'songs' | 'files' | '',
    });

    // Getters
    const hasSongs = computed(() => songs.value.length > 0);
    const sortedSongs = computed(() =>
        [...songs.value].sort((a, b) => a.titel.localeCompare(b.titel)),
    );

    // Actions
    async function loadSongsFromDB() {
        try {
            error.value = null;
            isLoading.value = true;
            const allSongs = await db.songs.toArray();
            songs.value = allSongs;

            // Hydrate the last sync time persisted across reloads
            const syncRow = await db.meta.get('lastSyncTime');
            if (syncRow) {
                lastSyncTime.value = new Date(syncRow.value);
            }

            // Hydrate failed downloads from the last sync/retry so the
            // incomplete-sync warning survives an app restart
            const failedRow = await db.meta.get('failedFiles');
            if (failedRow) {
                try {
                    const parsed: unknown = JSON.parse(failedRow.value);
                    if (Array.isArray(parsed)) {
                        failedFiles.value = parsed.filter(
                            (f): f is { id: string; filename: string } =>
                                !!f && typeof f.id === 'string' && typeof f.filename === 'string',
                        );
                    }
                } catch (parseErr) {
                    console.error('Error parsing persisted failed files:', parseErr);
                }
            }

            return allSongs;
        } catch (err) {
            console.error('Error loading songs from DB:', err);
            error.value = 'Failed to load songs from local database';
            throw err;
        } finally {
            isLoading.value = false;
            isInitialized.value = true;
        }
    }

    // The download name of every file the library references, built once per
    // batch — a delta after a bulk edit can name a thousand files, and each of
    // them used to walk the whole library looking for its name.
    function buildFilenameIndex(allSongs: Song[]): Map<string, string> {
        const names = new Map<string, string>();

        for (const song of allSongs) {
            if (song.notentextSvg) {
                names.set(song.notentextSvg.id, song.notentextSvg.filename_download);
            }
            if (song.notentextMxml) {
                names.set(song.notentextMxml.id, song.notentextMxml.filename_download);
            }
            for (const raster of song.noten) {
                names.set(raster.id, raster.filename_download);
            }
        }

        return names;
    }

    // Mirror the in-memory failed list into db.meta so it survives restarts.
    // Best-effort: a failure here (e.g. quota) must not mask the sync result.
    async function persistFailedFiles(): Promise<void> {
        try {
            if (failedFiles.value.length === 0) {
                await db.meta.delete('failedFiles');
            } else {
                await db.meta.put({
                    key: 'failedFiles',
                    value: JSON.stringify(failedFiles.value),
                });
            }
        } catch (err) {
            console.error('Error persisting failed files:', err);
        }
    }

    // Download files in batches to avoid overwhelming the browser.
    // Failures land in failedFiles; a full storage aborts the loop and throws.
    async function downloadFileBatch(fileIds: string[], allSongs: Song[]): Promise<void> {
        syncProgress.value.total = fileIds.length;
        syncProgress.value.current = 0;

        const filenames = buildFilenameIndex(allSongs);
        const nameOf = (fileId: string) => filenames.get(fileId) ?? `${fileId}.bin`;

        const batchSize = 5;
        let quotaHit = false;

        for (let i = 0; i < fileIds.length; i += batchSize) {
            if (quotaHit) {
                // Storage is full — record the remaining files as failed
                // instead of attempting downloads that cannot be stored.
                for (const fileId of fileIds.slice(i)) {
                    failedFiles.value.push({ id: fileId, filename: nameOf(fileId) });
                }
                break;
            }

            const batch = fileIds.slice(i, i + batchSize);

            await Promise.all(
                batch.map(async (fileId) => {
                    const filename = nameOf(fileId);
                    try {
                        const blob = await fetchFile(fileId);
                        await db.files.put({ id: fileId, blob, filename });
                        syncProgress.value.current++;
                    } catch (err) {
                        failedFiles.value.push({ id: fileId, filename });
                        if (isQuotaExceeded(err)) {
                            quotaHit = true;
                        }
                    }
                }),
            );
        }

        // Persist the final failed list (or clear the row) even when the
        // quota abort below throws — the warning must survive a restart.
        await persistFailedFiles();

        if (quotaHit) {
            error.value =
                'Nicht genügend Speicherplatz auf Ihrem Gerät. Bitte geben Sie Speicherplatz frei und versuchen Sie es erneut.';
            throw new Error('QuotaExceededError');
        }
    }

    async function persistLastSyncTime(): Promise<void> {
        lastSyncTime.value = new Date();
        await db.meta.put({ key: 'lastSyncTime', value: lastSyncTime.value.toISOString() });
    }

    // What the server said about each stored blob when it was last seen, kept
    // as one JSON row rather than a column on db.files: reading a column back
    // would mean reading every Blob with it.
    const FILE_STAMPS_KEY = 'fileStamps';

    async function loadFileStamps(): Promise<Record<string, string | null>> {
        try {
            const row = await db.meta.get(FILE_STAMPS_KEY);
            if (!row) return {};

            const parsed: unknown = JSON.parse(row.value);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

            return parsed as Record<string, string | null>;
        } catch (err) {
            console.error('Error reading file stamps:', err);
            return {};
        }
    }

    // Best-effort, like the failed-file list: losing the stamps costs a
    // freshness check, never a file.
    async function persistFileStamps(stamps: Record<string, string | null>): Promise<void> {
        try {
            await db.meta.put({ key: FILE_STAMPS_KEY, value: JSON.stringify(stamps) });
        } catch (err) {
            console.error('Error persisting file stamps:', err);
        }
    }

    // The ids of the stored blobs, read from the index — never the blobs.
    async function storedFileIds(): Promise<string[]> {
        return (await db.files.toCollection().primaryKeys()) as string[];
    }

    // Write freshly fetched songs and drop the ones the server no longer offers
    async function applySongUpdates(fetched: Song[], removedIds: string[]): Promise<void> {
        if (fetched.length > 0 || removedIds.length > 0) {
            await db.transaction('rw', db.songs, async () => {
                if (fetched.length > 0) await db.songs.bulkPut(fetched);
                if (removedIds.length > 0) await db.songs.bulkDelete(removedIds);
            });
        }

        songs.value = await db.songs.toArray();
    }

    // An empty result against a filled library is far more likely a permission
    // or filter accident than an emptied Gesangbuch. Refuse it — deleting every
    // song on the device is not something to get wrong quietly.
    function guardEmptyResult(remoteCount: number, localCount: number): void {
        if (remoteCount === 0 && localCount > 0) {
            throw new Error(
                'Der Server hat keine Lieder gemeldet. Die vorhandenen Lieder bleiben erhalten.',
            );
        }
    }

    /**
     * The delta path: pull the records whose timestamps moved, drop what left
     * the book, and report the blobs still missing.
     */
    async function syncFromManifest(
        manifest: SongManifestEntry[],
        full: boolean,
    ): Promise<string[]> {
        const local = await db.songs.toArray();
        guardEmptyResult(manifest.length, local.length);

        const { changedIds, removedIds } = diffSongs(manifest, local, { full });

        const fetched = changedIds.length > 0 ? await fetchSongsByIds(changedIds) : [];
        await applySongUpdates(stampSongs(fetched, manifest), removedIds);

        return diffFiles(manifest, new Set(await storedFileIds()), await loadFileStamps(), {
            full,
        });
    }

    /**
     * The path without a manifest: pull every record, because there is nothing
     * to compare against. The files are still diffed — by id, which is all the
     * song query knows about them.
     */
    async function syncEverything(): Promise<string[]> {
        const { songs: fetched, fileIds } = await fetchSongsWithFiles();

        const localIds = (await db.songs.toCollection().primaryKeys()) as string[];
        guardEmptyResult(fetched.length, localIds.length);

        const fetchedIds = new Set(fetched.map((song) => song.id));
        await applySongUpdates(
            fetched,
            localIds.filter((id) => !fetchedIds.has(id)),
        );

        const present = new Set(await storedFileIds());
        return fileIds.filter((id) => !present.has(id));
    }

    /**
     * Blobs nothing points at any more.
     *
     * The notation pipeline uploads a *new* Directus file per run instead of
     * replacing one, so every regenerated Notenbild leaves its predecessor
     * behind. Held against the local songs, so a raster fetched on demand
     * survives — it is referenced through `song.noten`.
     */
    async function pruneOrphanedFiles(): Promise<void> {
        if (songs.value.length === 0) return;

        try {
            const orphans = findOrphanFileIds(await storedFileIds(), songs.value);
            if (orphans.length > 0) await db.files.bulkDelete(orphans);
        } catch (err) {
            console.error('Error pruning orphaned files:', err);
        }
    }

    /**
     * Bring the local library up to date.
     *
     * Only what actually changed: a manifest says what the server holds, and
     * the diff against IndexedDB decides which records to pull and which blobs
     * to fetch — a repeat sync of an unchanged book downloads nothing.
     *
     * `full: true` skips that comparison and pulls everything. That is the hook
     * for invalidating the set as a whole (a content version bump), where no
     * per-item timestamp can be trusted to say what is stale.
     */
    async function syncAll(options: { full?: boolean } = {}) {
        const full = options.full === true;

        // Fire-and-forget: ask the browser to protect local content from eviction
        void requestPersistentStorage();

        isSyncing.value = true;
        error.value = null;
        failedFiles.value = [];
        syncProgress.value = { current: 0, total: 0, phase: 'songs' };

        try {
            // Step 1: work out what changed, and fetch those songs
            syncProgress.value.phase = 'songs';
            const manifest = await fetchSongManifest();
            const fileIds = manifest
                ? await syncFromManifest(manifest, full)
                : await syncEverything();

            // Step 2: download the files that are missing or superseded
            syncProgress.value.phase = 'files';

            await downloadFileBatch(fileIds, songs.value);

            await pruneOrphanedFiles();

            if (manifest) {
                await persistFileStamps(buildFileStamps(manifest, new Set(await storedFileIds())));
            }

            // Only a sync without failed files may record success — a partial
            // download must not pretend the content is complete and current.
            if (failedFiles.value.length === 0) {
                await persistLastSyncTime();
            }

            syncProgress.value.phase = '';
        } catch (err) {
            console.error('Error during sync:', err);
            // Keep a message already set inside the sync (e.g. the quota message)
            if (!error.value) {
                error.value = err instanceof Error ? err.message : 'Failed to complete sync';
            }
            throw err;
        } finally {
            isSyncing.value = false;
        }
    }

    // Retry ONLY the files that failed during the last sync/retry.
    async function retryFailedFiles(): Promise<void> {
        if (isSyncing.value || failedFiles.value.length === 0) return;

        isSyncing.value = true;
        error.value = null;
        syncProgress.value = { current: 0, total: 0, phase: 'files' };

        try {
            const ids = failedFiles.value.map((f) => f.id);
            failedFiles.value = [];
            await downloadFileBatch(ids, songs.value);

            if (failedFiles.value.length === 0) {
                await persistLastSyncTime();
            }
        } finally {
            isSyncing.value = false;
            syncProgress.value.phase = '';
        }
    }

    /**
     * Whether the server holds something the device does not.
     *
     * Two counts, ~100 bytes: how large the set is, and how much of it moved
     * after the newest timestamp stored here (server clock against server
     * clock — never against client time). A different size means a song was
     * added or withdrawn; a change count means content moved.
     *
     * Returns null when no statement is possible — offline, or the timestamps
     * are not readable. That is not the same as "nothing changed".
     */
    async function checkForUpdates(): Promise<boolean | null> {
        try {
            const local = songs.value.length > 0 ? songs.value : await db.songs.toArray();
            const { total, changed } = await fetchChangeCounts(latestLocalStamp(local));

            if (total !== local.length) return true;
            if (changed === null) return null;

            return changed > 0;
        } catch (err) {
            console.warn('Update check unavailable:', err);
            return null;
        }
    }

    async function getFileBlob(fileId: string): Promise<Blob | null> {
        try {
            const file = await db.files.get(fileId);
            return file?.blob || null;
        } catch (err) {
            console.error('Error getting file blob:', err);
            return null;
        }
    }

    // Dexie-first blob lookup with an on-demand network fallback: a blob that
    // was never synced (or was evicted) is fetched once and stored back into
    // db.files so the next open works offline.
    async function getOrFetchFileBlob(fileId: string, filename?: string): Promise<Blob | null> {
        const local = await getFileBlob(fileId);
        if (local) return local;
        if (!navigator.onLine) return null;

        let blob: Blob;
        try {
            blob = await fetchFile(fileId);
        } catch (err) {
            console.error('On-demand file fetch failed:', err);
            return null;
        }

        // Store for the next offline open — but never discard a blob already
        // in hand just because storing it failed (e.g. quota exceeded).
        try {
            await db.files.put({ id: fileId, blob, filename: filename ?? `${fileId}.bin` });
        } catch (err) {
            console.error('Storing on-demand file failed:', err);
        }

        return blob;
    }

    async function getStoredFilesCount(): Promise<number> {
        try {
            return await db.files.count();
        } catch (err) {
            console.error('Error counting files:', err);
            return 0;
        }
    }

    async function clearAllData() {
        try {
            error.value = null;
            await db.transaction('rw', db.songs, db.files, db.meta, async () => {
                await db.songs.clear();
                await db.files.clear();
                await db.meta.clear();
            });
            songs.value = [];
            lastSyncTime.value = null;
            failedFiles.value = [];
        } catch (err) {
            console.error('Error clearing data:', err);
            error.value = 'Failed to clear local data';
            throw err;
        }
    }

    // Initialize on store creation
    loadSongsFromDB();

    return {
        // State
        songs: sortedSongs,
        isLoading,
        isInitialized,
        isSyncing,
        error,
        lastSyncTime,
        failedFiles,
        syncProgress,
        hasSongs,

        // Actions
        loadSongsFromDB,
        syncAll,
        retryFailedFiles,
        checkForUpdates,
        getFileBlob,
        getOrFetchFileBlob,
        getStoredFilesCount,
        clearAllData,
    };
});
