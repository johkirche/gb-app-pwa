import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import { directusConfig } from '@/services/directus';
import { SESSION_ENDED_ERROR, handleApiError } from '@/services/errorHandler';

/**
 * Files API
 *
 * Handles file fetching from Directus assets endpoint with authentication.
 */

// Get current token from user store
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

// Fetch a file (PNG/JPG/SVG) from Directus
export async function fetchFile(fileId: string): Promise<Blob> {
    try {
        const token = await getCurrentToken();
        const url = `${directusConfig.url}/assets/${fileId}`;
        const response = await fetch(url, {
            headers: {
                Authorization: token ? `Bearer ${token}` : '',
            },
        });

        if (!response.ok) {
            // If unauthorized, try to refresh token
            if (response.status === 401) {
                const refreshed = await refreshAuthToken();
                if (refreshed) {
                    // Retry with new token
                    const newToken = await getCurrentToken();
                    const retryResponse = await fetch(url, {
                        headers: {
                            Authorization: newToken ? `Bearer ${newToken}` : '',
                        },
                    });
                    if (retryResponse.ok) {
                        return await retryResponse.blob();
                    }
                }
            }
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        return await response.blob();
    } catch (error) {
        console.error('Error fetching file from Directus:', error);

        // Check for invalid credentials (user account may be deleted)
        const handled = await handleApiError(error);
        if (handled) {
            throw new Error(SESSION_ENDED_ERROR, { cause: error });
        }

        throw error;
    }
}

/** A file in Directus' file library, as far as the sync needs to know it. */
export interface DirectusFileInfo {
    id: string;
    /** When its content last changed: the stamp a re-download is decided by. */
    modifiedOn: string | null;
}

/**
 * The newest file in the library with this download name, or null when there
 * is none. Throws when the question cannot be answered (offline, no access):
 * the caller must tell "not there" from "could not ask", or a dropped
 * connection would read as the file having been taken down.
 */
export async function findFileByName(filename: string): Promise<DirectusFileInfo | null> {
    const params = new URLSearchParams({
        'filter[filename_download][_eq]': filename,
        fields: 'id,modified_on,uploaded_on',
        sort: '-uploaded_on',
        limit: '1',
    });
    const url = `${directusConfig.url}/files?${params}`;

    const request = async () => {
        const token = await getCurrentToken();
        return fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
    };

    let response = await request();
    if (response.status === 401 && (await refreshAuthToken())) {
        response = await request();
    }
    if (!response.ok) {
        throw new Error(`Failed to look up ${filename}: ${response.status}`);
    }

    const body = (await response.json()) as {
        data?: { id: string; modified_on?: string | null; uploaded_on?: string | null }[];
    };
    const file = body.data?.[0];
    if (!file) return null;
    return { id: file.id, modifiedOn: file.modified_on ?? file.uploaded_on ?? null };
}
