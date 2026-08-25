import { useUserStore } from '@/stores/user';

import { db } from '@/db';

/**
 * Error Handler Service
 *
 * Global error handling for API errors, especially authentication errors.
 * When invalid credentials are detected (e.g., user account deleted),
 * this clears all local data and redirects to login.
 */

// Logout reasons that can be passed to the login page
export type LogoutReason =
    | 'account_deleted'
    | 'session_expired'
    | 'invalid_credentials'
    | 'registration_login_failed';

// Human-readable messages for each logout reason (German)
export const LOGOUT_REASON_MESSAGES: Record<LogoutReason, string> = {
    account_deleted: 'Ihr Konto wurde gelöscht. Alle lokalen Daten wurden entfernt.',
    session_expired: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    invalid_credentials: 'Ungültige Anmeldedaten. Bitte melden Sie sich erneut an.',
    registration_login_failed:
        'Ihr Konto wurde erfolgreich erstellt. Die automatische Anmeldung ist fehlgeschlagen – bitte melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.',
};

/**
 * Extract the most specific human-readable message from a Directus/SDK error.
 *
 * The Directus REST SDK rejects with a plain object (not an Error instance):
 *   { message, errors: [{ message, extensions: { code, message? } }], response }
 *
 * The register extension builds its errors with a message *function*, so
 * `errors[0].message` already carries the specific text. `extensions.message` is
 * still checked first because other endpoints may only populate that.
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

/**
 * Extract `errors[0].extensions.code` from a Directus error envelope.
 *
 * The register extension uses this to distinguish a duplicate account
 * (`USER_ALREADY_REGISTERED`) from ordinary validation failures (`INVALID_PAYLOAD`).
 */
export function extractDirectusErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;

    const errorObj = error as Record<string, unknown>;
    if (!Array.isArray(errorObj.errors) || errorObj.errors.length === 0) return undefined;

    const first = errorObj.errors[0] as Record<string, unknown> | undefined;
    const extensions = first?.extensions as Record<string, unknown> | undefined;

    return typeof extensions?.code === 'string' ? extensions.code : undefined;
}

/** Error code the register extension returns when the email already has an account. */
export const USER_ALREADY_REGISTERED = 'USER_ALREADY_REGISTERED';

/**
 * Synthetic code for "the account was created, but the automatic login failed".
 * Not a server code: the extension consumed the one-time activation code, so the
 * registration itself succeeded and must not be reported as failed — the caller
 * routes to the login page instead of letting the user retry the registration
 * (which could only yield USER_ALREADY_REGISTERED).
 */
export const REGISTRATION_LOGIN_FAILED = 'REGISTRATION_LOGIN_FAILED';

const REGISTRATION_FALLBACK_MESSAGE =
    'Die Registrierung ist fehlgeschlagen. Bitte versuchen Sie es später erneut.';

/**
 * Translate a registration failure into a German message for the UI.
 *
 * The extension replies in English and only separates the duplicate-account case by
 * error code — every other validation failure shares `INVALID_PAYLOAD`. Those are told
 * apart by the message text, which is deliberate but brittle: rewording a message in the
 * extension silently drops it to the generic fallback. The set below covers every message
 * the extension can currently produce, so the fallback should stay a genuine last resort.
 */
export function translateRegistrationError(error: unknown): string {
    if (extractDirectusErrorCode(error) === USER_ALREADY_REGISTERED) {
        return 'Für diese E-Mail-Adresse besteht bereits ein Konto. Bitte melden Sie sich an.';
    }

    const message = extractDirectusErrorMessage(error);
    if (!message) return REGISTRATION_FALLBACK_MESSAGE;

    if (message.includes('registration code')) {
        return 'Dieser Aktivierungscode ist ungültig oder wurde bereits verwendet.';
    }

    if (message.startsWith('Password must contain')) {
        return 'Das Passwort erfüllt nicht die Anforderungen: mindestens 8 Zeichen, ein Großbuchstabe und eine Zahl oder ein Sonderzeichen.';
    }

    if (message.startsWith('Missing required fields')) {
        return 'Bitte füllen Sie E-Mail-Adresse, Passwort und Aktivierungscode aus.';
    }

    if (message.startsWith('Default role not found')) {
        return 'Die Registrierung ist serverseitig nicht korrekt konfiguriert. Bitte wenden Sie sich an den Support.';
    }

    return REGISTRATION_FALLBACK_MESSAGE;
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
 * What the API modules throw with once a request has been answered by ending the
 * session, and the predicate that recognises it again afterwards.
 *
 * Shared rather than repeated per module because two very different callers need
 * it: the API wrappers, to keep "your session went" distinguishable from "the
 * request failed" after they rephrase the error, and the sync, to tell the reader
 * which of the two happened.
 */
export const SESSION_ENDED_ERROR = 'Invalid credentials - user logged out';

export function isSessionEndedError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith('Invalid credentials');
}

/** German message shown when a request failed because the server was unreachable. */
export const NETWORK_ERROR_MESSAGE =
    'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.';

/**
 * Detect a network-level failure (offline, DNS, refused connection, CORS).
 *
 * `fetch()` rejects those as a `TypeError` whose message differs per browser
 * ("Failed to fetch" in Chromium, "NetworkError when attempting to fetch a
 * resource." in Firefox, "Load failed" in Safari), so the TypeError check does the
 * heavy lifting and the message checks catch wrapped/re-thrown variants.
 */
export function isNetworkError(error: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return true;
    }
    if (error instanceof TypeError) {
        return true;
    }
    const message = extractDirectusErrorMessage(error);
    return !!message && (message.includes('Failed to fetch') || message.includes('NetworkError'));
}

/**
 * Translate a login failure into a German message for the UI.
 *
 * The Directus SDK rejects with a plain error envelope (not an `Error`), so showing
 * `err.message` would surface English server text — or nothing at all. The generic
 * fallback deliberately does not echo `extractDirectusErrorMessage`, which would also
 * be English.
 */
export function translateLoginError(error: unknown): string {
    if (isInvalidCredentialsError(error)) {
        return 'E-Mail-Adresse oder Passwort ist falsch.';
    }
    if (isNetworkError(error)) {
        return NETWORK_ERROR_MESSAGE;
    }
    return 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es später erneut.';
}

/**
 * Clear only the session: auth tokens and the cached user record.
 *
 * Songs, files, playlists, favorites and preferences are deliberately kept. An expired
 * or rotated-away token says nothing about whether the account still exists, and the
 * user's downloaded hymnal and their hand-made playlists must survive a re-login.
 */
export async function clearSessionData(): Promise<void> {
    try {
        await db.transaction('rw', [db.auth, db.users], async () => {
            await db.auth.clear();
            await db.users.clear();
        });
    } catch (error) {
        console.error('Error clearing session data:', error);
        try {
            await db.auth.clear();
            await db.users.clear();
        } catch (innerError) {
            console.error('Error clearing session tables individually:', innerError);
        }
    }
}

/**
 * Clear everything that belongs to the signed-in account, for an explicit logout.
 *
 * Songs and files are deliberately kept — they are shared hymnal content, identical for
 * every account and expensive to re-download. Playlists, favorites, preferences and the
 * Gottesdienst selection are personal data that exist only on this device; they must not
 * leak to the next account that signs in on a shared device, so they go together with the
 * session.
 */
export async function clearUserScopedData(): Promise<void> {
    const tables = [db.auth, db.users, db.playlists, db.preferences, db.favorites, db.services];

    try {
        await db.transaction('rw', tables, async () => {
            for (const table of tables) {
                await table.clear();
            }
        });
    } catch (error) {
        console.error('Error clearing user-scoped data:', error);
        // Even if the transaction fails, try to clear the tables individually
        for (const table of tables) {
            try {
                await table.clear();
            } catch (innerError) {
                console.error(`Error clearing table ${table.name}:`, innerError);
            }
        }
    }
}

/**
 * Clear all local user data from IndexedDB.
 *
 * This removes songs, files, playlists, favorites, preferences, the Gottesdienst
 * selection, sync metadata, auth and user data, and is destructive and irreversible —
 * playlists, favorites and preferences exist only on this device and cannot be restored
 * from the server. Only call this when
 * the account is genuinely known to be gone; for an ordinary expired session use
 * {@link clearSessionData} instead.
 */
export async function clearAllLocalData(): Promise<void> {
    const tables = [
        db.auth,
        db.users,
        db.songs,
        db.files,
        db.playlists,
        db.preferences,
        db.favorites,
        db.services,
        db.meta,
    ];

    try {
        // Clear all tables in a transaction
        await db.transaction('rw', tables, async () => {
            for (const table of tables) {
                await table.clear();
            }
        });
    } catch (error) {
        console.error('Error clearing local data:', error);
        // Even if transaction fails, try to clear tables individually
        for (const table of tables) {
            try {
                await table.clear();
            } catch (innerError) {
                console.error(`Error clearing table ${table.name}:`, innerError);
            }
        }
    }

    // localStorage belongs to the full wipe too: the Datenschutz page promises that a
    // deleted account removes "sämtliche lokal gespeicherten Daten", and a leftover
    // onboarding.inProgress would strand the next user in the previous account's
    // onboarding.
    try {
        localStorage.removeItem('onboarding.inProgress');
        localStorage.removeItem('onboarding.currentStep');
        localStorage.removeItem('settings.theme');
    } catch {
        // ignore storage errors
    }
}

/**
 * Whether this device holds a downloaded Gesangbuch.
 *
 * Counted straight off the songs table rather than through the store: this module
 * sits underneath the stores — every API module imports it — and the count is an
 * index read, so it costs nothing next to loading the songs themselves.
 */
async function hasDownloadedLibrary(): Promise<boolean> {
    try {
        return (await db.songs.count()) > 0;
    } catch (error) {
        console.error('Error counting local songs:', error);
        return false;
    }
}

/**
 * End the session and decide where that leaves the reader.
 *
 * The reason decides how much is deleted:
 *   - `account_deleted` clears everything, including the downloaded hymnal and playlists.
 *   - every other reason clears only the session and leaves local content untouched.
 *
 * The default is `session_expired` on purpose. A 401 from Directus is ambiguous — an
 * expired refresh token, a revoked session and a deleted account all look alike from the
 * client — so the non-destructive reading is the only safe one. Pass `account_deleted`
 * explicitly, and only where the deletion is actually known.
 *
 * A device that holds a downloaded Gesangbuch is NOT sent to the login form. Doing that
 * is what used to happen, and it took the whole book away over a token — typically
 * offline, where signing back in is not even possible. The session ends quietly instead:
 * the app stays where it is on the local content, and asks for a sign-in only on the
 * features that actually need the server (see `LoginRequiredNotice`). Only a device with
 * nothing to read has anywhere else to go, and only that one is redirected.
 */
export async function handleInvalidCredentials(
    reason: LogoutReason = 'session_expired',
): Promise<void> {
    if (reason === 'account_deleted') {
        await clearAllLocalData();
        // Force a full page reload so no cached state survives the deletion.
        window.location.href = `/login?reason=${reason}`;
        return;
    }

    await clearSessionData();

    if (await hasDownloadedLibrary()) {
        // The tokens are gone from IndexedDB; the store still holds them in memory,
        // and a stale `isLoggedIn` would keep the UI offering what can no longer work.
        useUserStore().endSession();
        return;
    }

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
        // Ambiguous 401 -> treat as an expired session and keep the user's local content.
        await handleInvalidCredentials('session_expired');
        return true; // Error was handled
    }
    return false; // Error was not handled
}
