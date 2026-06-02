import { db } from '@/db';

/**
 * Error Handler Service
 *
 * Global error handling for API errors, especially authentication errors.
 * When invalid credentials are detected (e.g., user account deleted),
 * this clears all local data and redirects to login.
 */

// Logout reasons that can be passed to the login page
export type LogoutReason = 'account_deleted' | 'session_expired' | 'invalid_credentials';

// Human-readable messages for each logout reason (German)
export const LOGOUT_REASON_MESSAGES: Record<LogoutReason, string> = {
    account_deleted: 'Ihr Konto wurde gelöscht. Alle lokalen Daten wurden entfernt.',
    session_expired: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    invalid_credentials: 'Ungültige Anmeldedaten. Bitte melden Sie sich erneut an.',
};

/**
 * Extract the most specific human-readable message from a Directus/SDK error.
 *
 * The Directus REST SDK rejects with a plain object (not an Error instance):
 *   { message, errors: [{ message, extensions: { code, message? } }], response }
 *
 * Custom endpoint extensions that build errors with a *static* default message put
 * the specific message in `errors[0].extensions.message`, while `errors[0].message`
 * stays generic (e.g. "Invalid payload"). Prefer the most specific value available.
 */
export function extractDirectusErrorMessage(error: unknown): string | undefined {
    if (!error) return undefined;
    if (typeof error === 'string') return error;
    if (error instanceof Error && error.message) return error.message;

    if (typeof error === 'object') {
        const errorObj = error as Record<string, unknown>;

        if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
            const first = errorObj.errors[0] as Record<string, unknown>;
            const extensions = first?.extensions as Record<string, unknown> | undefined;
            if (extensions && typeof extensions.message === 'string' && extensions.message) {
                return extensions.message;
            }
            if (typeof first?.message === 'string' && first.message) {
                return first.message;
            }
        }

        if (typeof errorObj.message === 'string' && errorObj.message) {
            return errorObj.message;
        }
    }

    return undefined;
}

// Check if an error indicates invalid credentials
export function isInvalidCredentialsError(error: unknown): boolean {
    if (!error) return false;

    // Check for string message
    if (typeof error === 'string') {
        return error.includes('Invalid user credentials');
    }

    // Check for Error object
    if (error instanceof Error) {
        return error.message.includes('Invalid user credentials');
    }

    // Check for Directus error object structure
    if (typeof error === 'object' && error !== null) {
        const errorObj = error as Record<string, unknown>;

        // Check message property
        if (typeof errorObj.message === 'string') {
            if (errorObj.message.includes('Invalid user credentials')) {
                return true;
            }
        }

        // Check errors array (Directus format)
        if (Array.isArray(errorObj.errors)) {
            for (const err of errorObj.errors) {
                if (typeof err === 'object' && err !== null) {
                    const errItem = err as Record<string, unknown>;
                    if (
                        typeof errItem.message === 'string' &&
                        errItem.message.includes('Invalid user credentials')
                    ) {
                        return true;
                    }
                    // Check extensions.code
                    if (typeof errItem.extensions === 'object' && errItem.extensions !== null) {
                        const extensions = errItem.extensions as Record<string, unknown>;
                        if (extensions.code === 'INVALID_CREDENTIALS') {
                            return true;
                        }
                    }
                }
            }
        }

        // Check response status for 401
        if (typeof errorObj.response === 'object' && errorObj.response !== null) {
            const response = errorObj.response as Record<string, unknown>;
            if (response.status === 401) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Clear all local user data from IndexedDB
 * This removes songs, files, playlists, preferences, auth, and user data
 */
export async function clearAllLocalData(): Promise<void> {
    console.log('Clearing all local data due to invalid credentials...');

    try {
        // Clear all tables in a transaction
        await db.transaction(
            'rw',
            [db.auth, db.users, db.songs, db.files, db.playlists, db.preferences],
            async () => {
                await db.auth.clear();
                await db.users.clear();
                await db.songs.clear();
                await db.files.clear();
                await db.playlists.clear();
                await db.preferences.clear();
            },
        );

        console.log('All local data cleared successfully');
    } catch (error) {
        console.error('Error clearing local data:', error);
        // Even if transaction fails, try to clear tables individually
        try {
            await db.auth.clear();
            await db.users.clear();
            await db.songs.clear();
            await db.files.clear();
            await db.playlists.clear();
            await db.preferences.clear();
        } catch (innerError) {
            console.error('Error clearing individual tables:', innerError);
        }
    }
}

/**
 * Handle invalid credentials error
 * Clears all local data and redirects to login page with reason
 */
export async function handleInvalidCredentials(
    reason: LogoutReason = 'account_deleted',
): Promise<void> {
    console.warn('Invalid credentials detected - user account may have been deleted');

    // Clear all local data
    await clearAllLocalData();

    // Redirect to login page with reason query parameter
    // Use window.location to force a full page reload and clear any cached state
    window.location.href = `/login?reason=${reason}`;
}

/**
 * Global API error handler
 * Call this in catch blocks to handle authentication errors appropriately
 */
export async function handleApiError(error: unknown): Promise<boolean> {
    if (isInvalidCredentialsError(error)) {
        await handleInvalidCredentials();
        return true; // Error was handled
    }
    return false; // Error was not handled
}
