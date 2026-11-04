import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import { demoUrl, getDemoKey } from '@/services/demoAccess';
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

/**
 * Whether a refresh that just returned false was the session ending. A refresh
 * the server turned down clears it; one that failed on the network returns false
 * too and leaves it standing, and that must not read as a lost session.
 */
function sessionEnded(): boolean {
    return !useUserStore().authData;
}

/**
 * Fetch a file (PNG/JPG/SVG) from Directus. Throws SESSION_ENDED_ERROR when the
 * answer was a 401 and the session did not survive asking for a new token.
 */
export async function fetchFile(
    fileId: string,
    options: { cache?: RequestCache } = {},
): Promise<Blob> {
    try {
        const token = await getCurrentToken();

        // A demo visitor has no session to ask Directus with; the demo endpoint
        // answers for the files of its own songs instead.
        const demoKey = getDemoKey();
        if (!token && demoKey) {
            const response = await fetch(demoUrl(demoKey, `/assets/${fileId}`), options);
            if (!response.ok) {
                throw new Error(`Failed to fetch demo file: ${response.status}`);
            }
            return await response.blob();
        }

        const url = `${directusConfig.url}/assets/${fileId}`;
        const response = await fetch(url, {
            ...options,
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
                        ...options,
                        headers: {
                            Authorization: newToken ? `Bearer ${newToken}` : '',
                        },
                    });
                    if (retryResponse.ok) {
                        return await retryResponse.blob();
                    }
                } else if (sessionEnded()) {
                    throw new Error(SESSION_ENDED_ERROR);
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
 * connection would read as the file having been taken down. A session that did
 * not survive the question throws SESSION_ENDED_ERROR, as in fetchFile.
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
    if (response.status === 401) {
        if (await refreshAuthToken()) {
            response = await request();
        } else if (sessionEnded()) {
            throw new Error(SESSION_ENDED_ERROR);
        }
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
