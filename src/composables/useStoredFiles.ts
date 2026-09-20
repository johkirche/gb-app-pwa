import { onScopeDispose, ref } from 'vue';

import { useSongsStore } from '@/stores/songs';

/**
 * Composable for working with stored files from Dexie
 */
export function useStoredFiles() {
    const songsStore = useSongsStore();

    /**
     * Get a blob URL for a stored file
     *
     * The URL holds its blob in memory until it is revoked, and nothing revokes
     * it for you — not a navigation, not the element that showed it being torn
     * down. Whoever takes one is taking ownership of that memory and owes it a
     * `releaseFileUrl` when it is replaced and when the holder goes away.
     *
     * @param fileId The Directus file ID
     * @param filename The real download filename, stored alongside an
     *                 on-demand-fetched blob (instead of '<id>.bin')
     * @returns A blob URL that can be used in img src, or null if not found
     */
    async function getFileUrl(fileId: string, filename?: string): Promise<string | null> {
        // On-demand network fallback included: a locally missing file is
        // fetched once and persisted back into Dexie.
        const blob = await songsStore.getOrFetchFileBlob(fileId, filename);
        if (!blob) return null;
        return URL.createObjectURL(blob);
    }

    /**
     * Hand back a URL from `getFileUrl` and let its blob go.
     *
     * Null-tolerant, because every caller holds the URL in a ref that starts
     * and ends as null, and guarding at each site would say the same thing
     * five times over.
     */
    function releaseFileUrl(url: string | null | undefined): void {
        if (url) URL.revokeObjectURL(url);
    }

    /**
     * Create a reactive image URL for a file
     *
     * Owned for the life of the calling scope: the URL is revoked when that
     * scope is torn down, so a component using this one never has to think
     * about it.
     *
     * @param fileId The Directus file ID
     */
    function useFileUrl(fileId: string) {
        const url = ref<string | null>(null);
        const isLoading = ref(true);
        // A scope that ends while the fetch is still out would otherwise be
        // handed a URL with nobody left to revoke it.
        let disposed = false;

        getFileUrl(fileId)
            .then((blobUrl) => {
                if (disposed) {
                    releaseFileUrl(blobUrl);
                    return;
                }
                url.value = blobUrl;
            })
            .catch((err) => {
                console.error('Error loading file:', err);
            })
            .finally(() => {
                isLoading.value = false;
            });

        onScopeDispose(() => {
            disposed = true;
            releaseFileUrl(url.value);
            url.value = null;
        });

        return { url, isLoading };
    }

    return {
        getFileUrl,
        releaseFileUrl,
        useFileUrl,
    };
}
