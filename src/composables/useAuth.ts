import { computed } from 'vue';

// The SDK's `logout` is aliased because this module defines its own.
import {
    deleteUser,
    logout as directusLogout,
    passwordRequest,
    passwordReset,
    readMe,
    withToken,
} from '@directus/sdk';

import { useFavoritesStore } from '@/stores/favorites';
import { useLesezeichenStore } from '@/stores/lesezeichen';
import { usePlaylistsStore } from '@/stores/playlists';
import { usePreferencesStore } from '@/stores/preferences';
import { useServiceStore } from '@/stores/service';
import { useUserStore } from '@/stores/user';

import {
    type DeviceLimit,
    EinstiegError,
    type Session,
    describeEinstiegError,
    deviceLimitOf,
    loginWithPassword,
} from '@/api/einstieg.api';
import { readOnboarded } from '@/api/profile.api';
import { SUPPORT_EMAIL } from '@/config/support';
import type { UserData } from '@/db';
import { directusClient } from '@/services/directus';
import {
    NETWORK_ERROR_MESSAGE,
    clearUserScopedData,
    extractDirectusErrorCode,
    handleInvalidCredentials,
    isInvalidCredentialsError,
    isNetworkError,
    translateLoginError,
} from '@/services/errorHandler';
import { forgetLastAccount, readLastAccount, rememberLastAccount } from '@/services/lastAccount';
import { refreshAuthToken } from '@/services/session';
import { releaseUserData } from '@/services/userData/sync';
import { resetRegisteredUserState } from '@/services/userStateReset';

/**
 * Self-deletion endpoint of the same extension. Deletes the authenticated
 * account server-side with system rights, releases the claimed activation code
 * (back to 'open') and cleans up rows whose foreign keys would block the
 * deletion — so the member role needs no permission on directus_users.
 */
const DELETE_ACCOUNT_ENDPOINT = '/directus-user-register-extension/account';

/**
 * Result of {@link useAuth().login}. `deviceLimit` when the password was right
 * but the account has no room for this device: the caller offers to sign one
 * of the others out.
 */
export type AuthResult =
    | { success: true; user: UserData }
    | { success: false; error: string; deviceLimit?: DeviceLimit };

/**
 * Result of {@link useAuth().deleteAccount}. `error` is already translated for
 * display; `code` carries the Directus error code (e.g. `FORBIDDEN`) for callers
 * that branch on the cause.
 */
export type DeleteAccountResult =
    | { success: true }
    | { success: false; error: string; code?: string };

/**
 * Everything personal on this device, gone: lists, marks, preferences, and the
 * copies the stores keep in memory. The songs stay; they are the same for
 * every account.
 */
async function clearAccountFromDevice(): Promise<void> {
    await clearUserScopedData();
    await releaseUserData();
    await useFavoritesStore().clearAll();
    await useLesezeichenStore().clearAll();
    // Whatever else keeps personal state in memory (the Bible's marks, notes,
    // plans …) registered itself to be reset here.
    await resetRegisteredUserState();
    await usePlaylistsStore().clearAll();
    await useServiceStore().clearAll();
    await usePreferencesStore().resetToDefaults();
}

export function useAuth() {
    const userStore = useUserStore();

    // Computed properties from store
    const isLoggedIn = computed(() => userStore.isLoggedIn);
    const isActivated = computed(() => userStore.isActivated);
    const user = computed(() => userStore.user);
    const isLoading = computed(() => userStore.isLoading);
    const error = computed(() => userStore.error);

    /**
     * Takes up a session the server has given out, however it was had: a code,
     * a password, a registration, a device swapped. Asks for the user with the
     * token just issued, as there is no session to sign with until setUser.
     *
     * A device whose session ended keeps the reader's lists and marks for
     * their return (see services/lastAccount). If somebody else signs in
     * instead, those go first: they are not the newcomer's, and a sync would
     * otherwise upload them into the wrong account.
     *
     * `knownEmail` is the address the reader just proved or typed, for a
     * profile that does not hand out its own (a role without read rights).
     */
    async function startSession(session: Session, knownEmail?: string): Promise<UserData> {
        // A bare 'role' would return the role's UUID; the nested selection asks
        // for the role's *name*, which the activation check below relies on.
        const userData = await directusClient.request(
            withToken(
                session.access_token,
                readMe({
                    fields: ['id', 'email', 'first_name', 'last_name', { role: ['name'] }],
                }),
            ),
        );

        // The client has no Schema generic, so the readMe output is loosely typed —
        // the cast keeps the shape explicit. If the policy forbids reading
        // directus_roles.name, role comes back null and we degrade to
        // 'user'/not activated instead of crashing.
        const roleName = (userData.role as { name?: string } | null)?.name ?? 'user';
        const user: UserData = {
            id: userData.id,
            email: userData.email ?? knownEmail,
            firstName: userData.first_name,
            lastName: userData.last_name,
            role: roleName,
            activated: roleName === 'activated',
        };

        const previous = readLastAccount();
        if (previous && previous.id !== user.id) {
            await clearAccountFromDevice();
        }

        await userStore.setUser(user, {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: Date.now() + (session.expires || 900000),
            refreshExpiresAt: session.refresh_expires ?? undefined,
        });
        rememberLastAccount({
            id: user.id,
            email: user.email,
            ...(user.firstName ? { firstName: user.firstName } : {}),
        });

        // Asked now, before the page that leads on to the onboarding: someone
        // who has been through it on another device is only missing the book.
        if (await readOnboarded()) {
            user.onboarded = true;
            await userStore.patchUser({ onboarded: true });
        }
        return user;
    }

    // The password way in. The usual one is a code (see SignInPage).
    async function login(email: string, password: string): Promise<AuthResult> {
        try {
            userStore.isLoading = true;
            userStore.error = null;

            const session = await loginWithPassword(email, password);
            const user = await startSession(session, email);
            return { success: true, user };
        } catch (err) {
            const deviceLimit = deviceLimitOf(err);
            if (deviceLimit) return { success: false, error: '', deviceLimit };

            const errorMessage =
                err instanceof EinstiegError
                    ? describeEinstiegError(err)
                    : translateLoginError(err);
            userStore.error = errorMessage;
            console.error('Login error:', err);
            return { success: false, error: errorMessage };
        } finally {
            userStore.isLoading = false;
        }
    }

    // Clear the current error message, e.g. when moving between form steps so a stale
    // failure from a previous attempt is not shown against the new input.
    function clearError() {
        userStore.error = null;
    }

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
            // anything: the revoke names the session by it, in its body.
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
            // lists, marks and preferences. They are on the account and come back
            // with the next login; the settings page warns before a logout that
            // would drop changes not yet uploaded. Songs and files stay — they are
            // shared hymnal content.
            await clearAccountFromDevice();
            await userStore.logout();
            // Leaving on purpose: the next sign-in is nobody's return.
            forgetLastAccount();

            // A half-finished onboarding belongs to the account that just left.
            try {
                localStorage.removeItem('onboarding.inProgress');
                localStorage.removeItem('onboarding.schritt');
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
    // changes not yet synced exist only on this device, so nothing may be
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

            // Without a session the request would go out unsigned (sessionFetch).
            if (!userStore.authData) {
                return { success: false, error: 'Sie sind nicht angemeldet.' };
            }

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
            // hard-redirect to /anmelden?reason=account_deleted, where the sign-in
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
        if (userStore.isTokenExpired() && userStore.authData?.refreshToken) {
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
        startSession,
        clearError,
        logout,
        deleteAccount,
        requestPasswordReset,
        resetPassword,
        ensureValidToken,
        setDevSkipAuth,
    };
}
