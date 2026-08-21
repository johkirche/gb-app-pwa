import { computed } from 'vue';

// The SDK's `logout` is aliased because this module defines its own logout().
import {
    deleteUser,
    logout as directusLogout,
    passwordRequest,
    passwordReset,
    readMe,
    refresh,
} from '@directus/sdk';

import { useFavoritesStore } from '@/stores/favorites';
import { usePlaylistsStore } from '@/stores/playlists';
import { usePreferencesStore } from '@/stores/preferences';
import { useServiceStore } from '@/stores/service';
import { useUserStore } from '@/stores/user';

import { SUPPORT_EMAIL } from '@/config/support';
import type { UserData } from '@/db';
import { directusClient } from '@/services/directus';
import {
    NETWORK_ERROR_MESSAGE,
    REGISTRATION_LOGIN_FAILED,
    clearUserScopedData,
    extractDirectusErrorCode,
    handleApiError,
    handleInvalidCredentials,
    isInvalidCredentialsError,
    isNetworkError,
    translateLoginError,
    translateRegistrationError,
} from '@/services/errorHandler';

/**
 * Endpoint path of the directus-user-register-extension.
 * Directus mounts endpoint extensions under their name, so the route exposed by
 * `router.post('/register', ...)` lives at `/<extension-name>/register`.
 */
const REGISTER_ENDPOINT = '/directus-user-register-extension/register';

/**
 * Self-deletion endpoint of the same extension. Deletes the authenticated
 * account server-side with system rights, releases the claimed activation code
 * (back to 'open') and cleans up rows whose foreign keys would block the
 * deletion — so the member role needs no permission on directus_users.
 */
const DELETE_ACCOUNT_ENDPOINT = '/directus-user-register-extension/account';

/** Result of {@link useAuth().login}. */
export type AuthResult = { success: true; user: UserData } | { success: false; error: string };

/**
 * Result of {@link useAuth().register}. `error` is already translated for display;
 * `code` is the raw extension error code, for callers that branch on the cause.
 */
export type RegisterResult =
    | { success: true; user: UserData }
    | { success: false; error: string; code?: string };

/**
 * Result of {@link useAuth().deleteAccount}. `error` is already translated for
 * display; `code` carries the Directus error code (e.g. `FORBIDDEN`) for callers
 * that branch on the cause.
 */
export type DeleteAccountResult =
    | { success: true }
    | { success: false; error: string; code?: string };

/**
 * The single in-flight refresh, or null when none is running.
 *
 * Directus rotates refresh tokens: the first `/auth/refresh` invalidates the token it
 * was called with. The download loop fetches files in batches of 5 concurrently, and
 * every one of them would otherwise call `refreshAuthToken()` with the *same* stored
 * refresh token — one wins and the other four get INVALID_CREDENTIALS, which used to
 * take the whole offline library down with it. Sharing one promise makes the refresh
 * happen exactly once no matter how many callers race for it.
 */
let inFlightRefresh: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
    try {
        const userStore = useUserStore();
        const refreshToken = userStore.authData?.refreshToken;

        if (!refreshToken) {
            return false;
        }

        const result = await directusClient.request(
            refresh({
                refresh_token: refreshToken,
                mode: 'json',
            }),
        );

        if (result.access_token && result.refresh_token) {
            const expiresAt = Date.now() + (result.expires || 900000);
            await userStore.updateTokens(result.access_token, result.refresh_token, expiresAt);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error refreshing token:', error);

        // A failed refresh means this session is over — it does NOT mean the account was
        // deleted, so this must not destroy the user's downloaded songs or playlists.
        if (isInvalidCredentialsError(error)) {
            await handleApiError(error);
            return false;
        }

        return false;
    }
}

/**
 * Refresh auth token - exported separately for use in API modules.
 *
 * Concurrent callers share a single network refresh; all of them resolve with the
 * result of that one request.
 */
export async function refreshAuthToken(): Promise<boolean> {
    if (inFlightRefresh) {
        return inFlightRefresh;
    }

    inFlightRefresh = performRefresh().finally(() => {
        inFlightRefresh = null;
    });

    return inFlightRefresh;
}

export function useAuth() {
    const userStore = useUserStore();

    // Computed properties from store
    const isLoggedIn = computed(() => userStore.isLoggedIn);
    const isActivated = computed(() => userStore.isActivated);
    const user = computed(() => userStore.user);
    const isLoading = computed(() => userStore.isLoading);
    const error = computed(() => userStore.error);

    // Login function
    async function login(email: string, password: string): Promise<AuthResult> {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            // Login with Directus SDK
            const result = await directusClient.login({ email, password });

            if (!result.access_token || !result.refresh_token) {
                throw new Error('Invalid response from server');
            }

            // Calculate token expiration (default 15 minutes)
            const expiresAt = Date.now() + (result.expires || 900000);

            // Fetch user data. A bare 'role' would return the role's UUID; the
            // nested selection asks for the role's *name*, which the activation
            // check below relies on.
            const userData = await directusClient.request(
                readMe({
                    fields: ['id', 'email', 'first_name', 'last_name', { role: ['name'] }],
                }),
            );

            // Map user data to our format. The client has no Schema generic, so the
            // readMe output is loosely typed — the cast keeps the shape explicit. If
            // the policy forbids reading directus_roles.name, role comes back null
            // and we degrade to 'user'/not activated instead of crashing.
            const roleName = (userData.role as { name?: string } | null)?.name ?? 'user';
            const user: UserData = {
                id: userData.id,
                email: userData.email,
                firstName: userData.first_name,
                lastName: userData.last_name,
                role: roleName,
                activated: roleName === 'activated',
            };

            // Save to store and IndexedDB
            await userStore.setUser(user, {
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                expiresAt,
            });

            return { success: true, user };
        } catch (err) {
            const errorMessage = translateLoginError(err);
            userStore.error = errorMessage;
            console.error('Login error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Register function - includes activation code validation.
    // On failure `code` carries the extension's error code (see USER_ALREADY_REGISTERED)
    // so the caller can react to *which* field was rejected, not just show the message.
    async function register(
        email: string,
        password: string,
        activationCode: string,
        firstName?: string,
        lastName?: string,
    ): Promise<RegisterResult> {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            // Register via the directus-user-register-extension. It validates the
            // registration code, creates an activated user and marks the code as used.
            // The Directus SDK expects a *command function* returning the request
            // options; `method` must be set explicitly (it defaults to GET otherwise)
            // and Content-Type defaults to application/json.
            await directusClient.request(() => ({
                path: REGISTER_ENDPOINT,
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                    registration_code: activationCode,
                    first_name: firstName,
                    last_name: lastName,
                }),
            }));

            // After successful registration with valid code, automatically log in.
            // If that login fails, the registration itself still succeeded — the
            // extension consumed the one-time activation code, so retrying the
            // registration could only yield USER_ALREADY_REGISTERED. Report the
            // synthetic code instead so the caller can route to the login page.
            const loginResult = await login(email, password);
            if (loginResult.success) {
                return loginResult;
            }

            // login() wrote its failure into the shared store error that LoginPage
            // renders; clear it so the "account created" notice on the login page is
            // not accompanied by a stale login error.
            userStore.error = null;
            return { success: false, error: '', code: REGISTRATION_LOGIN_FAILED };
        } catch (err) {
            const errorMessage = translateRegistrationError(err);
            userStore.error = errorMessage;
            console.error('Registration error:', err);
            return { success: false, error: errorMessage, code: extractDirectusErrorCode(err) };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Clear the current error message, e.g. when moving between form steps so a stale
    // failure from a previous attempt is not shown against the new input.
    function clearError() {
        userStore.error = null;
    }

    // Note: Activation is handled during registration via the register extension endpoint
    // (see REGISTER_ENDPOINT). No separate activation step is needed.

    // Request password reset
    async function requestPasswordReset(email: string) {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            await directusClient.request(
                passwordRequest(email, `${window.location.origin}/password-reset`),
            );

            return { success: true };
        } catch (err) {
            // German-first: never surface the backend's English error text.
            const errorMessage = isNetworkError(err)
                ? NETWORK_ERROR_MESSAGE
                : 'Die E-Mail zum Zurücksetzen konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.';
            userStore.error = errorMessage;
            console.error('Password reset request error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Reset password with token
    async function resetPassword(token: string, password: string) {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            await directusClient.request(passwordReset(token, password));

            return { success: true };
        } catch (err) {
            // German-first: never surface the backend's English error text. An expired
            // or already-used reset token comes back as INVALID_CREDENTIALS.
            let errorMessage: string;
            if (isInvalidCredentialsError(err)) {
                errorMessage =
                    'Der Link zum Zurücksetzen ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.';
            } else if (isNetworkError(err)) {
                errorMessage = NETWORK_ERROR_MESSAGE;
            } else {
                errorMessage =
                    'Das Zurücksetzen des Passworts ist fehlgeschlagen. Bitte versuchen Sie es später erneut.';
            }
            userStore.error = errorMessage;
            console.error('Password reset error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Logout function
    async function logout() {
        try {
            userStore.isLoading = true;

            // Read the refresh token from the persisted session BEFORE clearing
            // anything. The SDK's own in-memory auth storage is empty after every
            // page reload, so `directusClient.logout()` would post no token and the
            // server session would never be revoked — the REST command sends the
            // Dexie-persisted token explicitly.
            const refreshToken = userStore.authData?.refreshToken;
            if (refreshToken) {
                try {
                    await directusClient.request(
                        directusLogout({ refresh_token: refreshToken, mode: 'json' }),
                    );
                } catch (err) {
                    // Server-side revoke is best effort: logging out while offline
                    // must still clear this device.
                    console.warn('Directus logout failed, continuing with local logout:', err);
                }
            }

            // Clear everything user-scoped from this device: session, cached user,
            // playlists, favorites, preferences and the Gottesdienst selection. Songs
            // and files stay — they are shared hymnal content. The store resets below
            // are idempotent (db + memory), so overlapping with clearUserScopedData is
            // harmless.
            await clearUserScopedData();
            await userStore.logout();
            await useFavoritesStore().clearAll();
            await usePlaylistsStore().clearAll();
            await useServiceStore().clearAll();
            await usePreferencesStore().resetToDefaults();

            // A half-finished onboarding belongs to the account that just left.
            try {
                localStorage.removeItem('onboarding.inProgress');
                localStorage.removeItem('onboarding.currentStep');
            } catch {
                // ignore storage errors
            }

            return { success: true };
        } catch (err) {
            const errorMessage =
                'Die Abmeldung ist fehlgeschlagen. Bitte versuchen Sie es später erneut.';
            userStore.error = errorMessage;
            console.error('Logout error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Delete the account on the Directus server, then wipe this device.
    //
    // The local wipe is deliberately gated on the server's success response:
    // playlists and favorites exist only on this device, so nothing may be
    // destroyed while the account might still exist. Until the Directus role has
    // a delete-own permission on directus_users the server answers 403 FORBIDDEN
    // — that case returns honest instructions to request the deletion via the
    // support address instead of pretending anything was deleted.
    async function deleteAccount(): Promise<DeleteAccountResult> {
        // Never issue a delete without a real signed-in account (dev bypass has none).
        if (!userStore.user || userStore.devSkipAuth || userStore.user.id === 'guest') {
            return { success: false, error: 'Sie sind nicht angemeldet.' };
        }
        const userId = userStore.user.id;

        try {
            userStore.isLoading = true;
            userStore.error = null;

            // A stale token must not carry an irreversible delete: if the refresh
            // fails, a session_expired redirect may already be in flight — bail out
            // instead of racing it with a doomed request.
            if (!(await ensureValidToken())) {
                return {
                    success: false,
                    error: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
                };
            }

            // The SDK's in-memory auth storage is empty after every page reload,
            // so the Dexie-persisted session token must be handed to the client
            // explicitly (same pattern as the API modules).
            const token = userStore.authData?.accessToken;
            if (!token) {
                return { success: false, error: 'Sie sind nicht angemeldet.' };
            }
            await directusClient.setToken(token);

            try {
                // Preferred path: the register extension's self-deletion endpoint.
                // It also releases the claimed activation code so the mailed code
                // becomes usable again.
                await directusClient.request(() => ({
                    path: DELETE_ACCOUNT_ENDPOINT,
                    method: 'DELETE',
                }));
            } catch (endpointErr) {
                const endpointCode = extractDirectusErrorCode(endpointErr);
                const endpointStatus = (endpointErr as { response?: { status?: number } } | null)
                    ?.response?.status;

                if (
                    endpointCode !== 'ROUTE_NOT_FOUND' &&
                    endpointStatus !== 404 &&
                    endpointStatus !== 405
                ) {
                    throw endpointErr;
                }

                // Deployed extension does not have the endpoint yet — legacy
                // fallback: direct self-delete. Directus has no DELETE /users/me
                // route and the SDK no deleteMe command — deleting the own id is
                // the supported equivalent (needs the delete-own permission on
                // directus_users, otherwise the 403 path below explains the
                // e-mail route). The activation code stays consumed on this path.
                await directusClient.request(deleteUser(userId));
            }

            // Only now, after the server confirmed the deletion, is destroying
            // local data correct: clear everything (incl. songs and files) and
            // hard-redirect to /login?reason=account_deleted, where the login
            // page shows the "Konto gelöscht" banner.
            await handleInvalidCredentials('account_deleted');

            return { success: true };
        } catch (err) {
            console.error('Account deletion error:', err);

            const code = extractDirectusErrorCode(err);
            const status = (err as { response?: { status?: number } } | null)?.response?.status;

            if (code === 'FORBIDDEN' || status === 403) {
                return {
                    success: false,
                    code: 'FORBIDDEN',
                    error: `Die Kontolöschung ist derzeit nicht direkt möglich. Bitte kontaktieren Sie den Support unter ${SUPPORT_EMAIL}, um Ihr Konto löschen zu lassen.`,
                };
            }

            return {
                success: false,
                code,
                error: 'Das Konto konnte nicht gelöscht werden. Bitte versuchen Sie es später erneut.',
            };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Refresh token if needed
    async function ensureValidToken() {
        if (userStore.isTokenExpired && userStore.authData?.refreshToken) {
            return await refreshAuthToken();
        }
        return true;
    }

    // Dev-only auth bypass — in-memory flag; the router additionally gates on
    // import.meta.env.DEV, so this is inert in production builds.
    function setDevSkipAuth(skip: boolean) {
        userStore.setDevSkipAuth(skip);
    }

    return {
        // State
        isLoggedIn,
        isActivated,
        user,
        isLoading,
        error,

        // Methods
        login,
        register,
        clearError,
        logout,
        deleteAccount,
        requestPasswordReset,
        resetPassword,
        ensureValidToken,
        setDevSkipAuth,
    };
}
