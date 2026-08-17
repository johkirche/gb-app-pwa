import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

import { fetchFile } from '@/api/files.api';
import { fetchLatestContentUpdate, fetchSongsWithFiles } from '@/api/songs.api';
import { type Song, db } from '@/db';
import { requestPersistentStorage } from '@/services/storage';

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
        }
    }

    function resolveFilename(fileId: string, allSongs: Song[]): string {
        const song = allSongs.find(
            (s) => s.noten.some((n) => n.id === fileId) || s.notentextMxml?.id === fileId,
        );
        return (
            song?.noten.find((n) => n.id === fileId)?.filename_download ||
            (song?.notentextMxml?.id === fileId
                ? song.notentextMxml.filename_download
                : undefined) ||
            `${fileId}.bin`
        );
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

        const batchSize = 5;
        let quotaHit = false;

        for (let i = 0; i < fileIds.length; i += batchSize) {
            if (quotaHit) {
                // Storage is full — record the remaining files as failed
                // instead of attempting downloads that cannot be stored.
                for (const fileId of fileIds.slice(i)) {
                    failedFiles.value.push({
                        id: fileId,
                        filename: resolveFilename(fileId, allSongs),
                    });
                }
                break;
            }

            const batch = fileIds.slice(i, i + batchSize);

            await Promise.all(
                batch.map(async (fileId) => {
                    const filename = resolveFilename(fileId, allSongs);
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

    async function syncAll() {
        // Fire-and-forget: ask the browser to protect local content from eviction
        void requestPersistentStorage();

        isSyncing.value = true;
        error.value = null;
        failedFiles.value = [];
        syncProgress.value = { current: 0, total: 0, phase: 'songs' };

        try {
            // Step 1: Fetch and save songs
            syncProgress.value.phase = 'songs';
            const { songs: fetchedSongs } = await fetchSongsWithFiles();

            await db.transaction('rw', db.songs, async () => {
                await db.songs.clear();
                await db.songs.bulkAdd(fetchedSongs);
            });

            songs.value = fetchedSongs;

            // Step 2: Download all files
            syncProgress.value.phase = 'files';

            // Collect all unique file IDs from fetched songs
            const fileIds = new Set<string>();
            fetchedSongs.forEach((song) => {
                song.noten.forEach((note) => {
                    const filename = note.filename_download.toLowerCase();
                    if (
                        filename.endsWith('.png') ||
                        filename.endsWith('.jpg') ||
                        filename.endsWith('.jpeg') ||
                        filename.endsWith('.svg')
                    ) {
                        fileIds.add(note.id);
                    }
                });
                if (song.notentextMxml) {
                    fileIds.add(song.notentextMxml.id);
                }
            });

            await downloadFileBatch(Array.from(fileIds), fetchedSongs);

            // Only a sync without failed files may record success — a partial
            // download must not pretend the content is complete and current.
            if (failedFiles.value.length === 0) {
                await persistLastSyncTime();

                // Remember the server-side content timestamp for the staleness check
                const latest = await fetchLatestContentUpdate();
                if (latest) {
                    await db.meta.put({ key: 'lastServerUpdate', value: latest });
                }
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
     * Compare the newest server-side content timestamp against the one stored
     * at last sync (server clock vs server clock — never against client time).
     * Returns null when no statement is possible (offline, field missing,
     * never synced with the timestamp recorded).
     */
    async function checkForUpdates(): Promise<boolean | null> {
        const latest = await fetchLatestContentUpdate();
        if (!latest) return null;

        const stored = await db.meta.get('lastServerUpdate');
        if (!stored) return null;

        return new Date(latest).getTime() > new Date(stored.value).getTime();
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
