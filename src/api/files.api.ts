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
