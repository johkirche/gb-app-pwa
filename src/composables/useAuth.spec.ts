import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the auth composable.
 *
 * `refreshAuthToken` — regression tests for the refresh-token race. Directus rotates
 * refresh tokens, so a second `/auth/refresh` sent with an already-consumed token
 * fails. The download loop runs 5 file fetches at a time, and before the in-flight
 * promise was shared every one of them fired its own refresh — four failed, and the
 * resulting INVALID_CREDENTIALS wiped the user's whole offline library. These tests
 * pin the "exactly one request" behaviour in place.
 *
 * `login` — pins the nested role-name readMe query and the German error mapping.
 *
 * `register` — pins that a failed auto-login after a successful registration is NOT
 * reported as a registration failure (the one-time activation code is already used).
 *
 * `logout` — pins that the server revoke carries the Dexie-persisted refresh token
 * and that a failed revoke (e.g. offline) still logs out locally.
 *
 * `deleteAccount` — pins that the irreversible local wipe happens ONLY after the
 * server confirmed the deletion, and never when the request fails (the initial
 * production behaviour is a 403 until the role gets delete-own permission).
 */

const request = vi.fn();
const clientLogin = vi.fn();
const setToken = vi.fn();
const handleApiError = vi.fn();
const handleInvalidCredentials = vi.fn();
const extractDirectusErrorCode = vi.fn();
const clearUserScopedData = vi.fn();
const translateLoginError = vi.fn();
const translateRegistrationError = vi.fn();
// Both default to a falsy return (vi.fn() yields undefined) — individual tests
// opt in to the invalid-credentials / network branches via mockReturnValue(true).
const isInvalidCredentialsError = vi.fn();
const isNetworkError = vi.fn();
const updateTokens = vi.fn();
const setUser = vi.fn();
const storeLogout = vi.fn();
const favoritesClearAll = vi.fn();
const playlistsClearAll = vi.fn();
const preferencesResetToDefaults = vi.fn();

function freshUserStore() {
    return {
        authData: {
            accessToken: 'old-access',
            refreshToken: 'old-refresh',
            expiresAt: 0,
        } as { accessToken: string; refreshToken: string; expiresAt: number } | null,
        user: null as import('@/db').UserData | null,
        isLoggedIn: false,
        isActivated: false,
        isTokenExpired: false,
        isLoading: false,
        error: null as string | null,
        updateTokens: (...args: unknown[]) => updateTokens(...args),
        setUser: (...args: unknown[]) => setUser(...args),
        logout: (...args: unknown[]) => storeLogout(...args),
        setDevSkipAuth: vi.fn(),
    };
}
let userStore = freshUserStore();

vi.mock('@/services/directus', () => ({
    directusClient: {
        request: (...args: unknown[]) => request(...args),
        login: (...args: unknown[]) => clientLogin(...args),
        setToken: (...args: unknown[]) => setToken(...args),
    },
    directusConfig: { url: 'https://example.invalid' },
}));

vi.mock('@directus/sdk', () => ({
    // The command builders pass their input through so tests can assert exactly
    // what the composable asked the SDK to send.
    refresh: (payload: unknown) => payload,
    readMe: (query: unknown) => query,
    logout: (options: unknown) => options,
    deleteUser: (id: unknown) => id,
    passwordRequest: vi.fn(),
    passwordReset: vi.fn(),
}));

vi.mock('@/services/errorHandler', () => ({
    handleApiError: (...args: unknown[]) => handleApiError(...args),
    handleInvalidCredentials: (...args: unknown[]) => handleInvalidCredentials(...args),
    isInvalidCredentialsError: (...args: unknown[]) => isInvalidCredentialsError(...args),
    isNetworkError: (...args: unknown[]) => isNetworkError(...args),
    clearUserScopedData: (...args: unknown[]) => clearUserScopedData(...args),
    translateLoginError: (...args: unknown[]) => translateLoginError(...args),
    translateRegistrationError: (...args: unknown[]) => translateRegistrationError(...args),
    extractDirectusErrorCode: (...args: unknown[]) => extractDirectusErrorCode(...args),
    NETWORK_ERROR_MESSAGE: 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.',
    REGISTRATION_LOGIN_FAILED: 'REGISTRATION_LOGIN_FAILED',
}));

vi.mock('@/stores/user', () => ({
    useUserStore: () => userStore,
}));

// The content stores are mocked so importing useAuth never pulls '@/db' (Dexie)
// into jsdom; the vi.fn()s let the logout tests assert the resets happened.
vi.mock('@/stores/favorites', () => ({
    useFavoritesStore: () => ({ clearAll: (...args: unknown[]) => favoritesClearAll(...args) }),
}));

vi.mock('@/stores/playlists', () => ({
    usePlaylistsStore: () => ({ clearAll: (...args: unknown[]) => playlistsClearAll(...args) }),
}));

vi.mock('@/stores/preferences', () => ({
    usePreferencesStore: () => ({
        resetToDefaults: (...args: unknown[]) => preferencesResetToDefaults(...args),
    }),
}));

// Imported after the mocks so the module picks them up.
const { refreshAuthToken, useAuth } = await import('./useAuth');

beforeEach(() => {
    vi.resetAllMocks();
    userStore = freshUserStore();
});

describe('refreshAuthToken', () => {
    it('sends exactly one network refresh for concurrent callers', async () => {
        let release: (value: unknown) => void = () => {};
        request.mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = resolve;
                }),
        );

        // Five parallel callers, mirroring the download loop's batch size.
        const calls = Promise.all(Array.from({ length: 5 }, () => refreshAuthToken()));

        expect(request).toHaveBeenCalledTimes(1);

        release({ access_token: 'new-access', refresh_token: 'new-refresh', expires: 900000 });
        const results = await calls;

        expect(request).toHaveBeenCalledTimes(1);
        expect(results).toEqual([true, true, true, true, true]);
        expect(updateTokens).toHaveBeenCalledTimes(1);
        expect(updateTokens).toHaveBeenCalledWith('new-access', 'new-refresh', expect.any(Number));
    });

    it('starts a fresh request once the previous one has settled', async () => {
        request.mockResolvedValue({
            access_token: 'a',
            refresh_token: 'b',
            expires: 900000,
        });

        await refreshAuthToken();
        await refreshAuthToken();

        expect(request).toHaveBeenCalledTimes(2);
    });

    it('resolves every concurrent caller with false when the refresh fails', async () => {
        request.mockRejectedValue(new Error('rotated away'));

        const results = await Promise.all(Array.from({ length: 5 }, () => refreshAuthToken()));

        expect(request).toHaveBeenCalledTimes(1);
        expect(results).toEqual([false, false, false, false, false]);
        // A failed refresh must not trigger the destructive account-deleted path.
        expect(handleApiError).not.toHaveBeenCalled();
    });
});

describe('login', () => {
    it('requests the nested role name and maps it onto the stored user', async () => {
        clientLogin.mockResolvedValue({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires: 900000,
        });
        request.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.org',
            first_name: 'Erika',
            last_name: 'Muster',
            role: { name: 'activated' },
        });

        const { login } = useAuth();
        const result = await login('user@example.org', 'Passwort1');

        expect(result.success).toBe(true);
        // A bare 'role' field would return the role UUID; the nested selection is
        // what makes the activation check below possible.
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                fields: expect.arrayContaining([{ role: ['name'] }]),
            }),
        );
        expect(setUser).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'user-1',
                role: 'activated',
                activated: true,
            }),
            expect.objectContaining({
                accessToken: 'new-access',
                refreshToken: 'new-refresh',
            }),
        );
    });

    it('returns the German error mapping when Directus rejects the credentials', async () => {
        const sdkError = {
            errors: [
                {
                    message: 'Invalid user credentials',
                    extensions: { code: 'INVALID_CREDENTIALS' },
                },
            ],
        };
        clientLogin.mockRejectedValue(sdkError);
        translateLoginError.mockReturnValue('E-Mail-Adresse oder Passwort ist falsch.');

        const { login } = useAuth();
        const result = await login('user@example.org', 'falsch');

        expect(translateLoginError).toHaveBeenCalledWith(sdkError);
        expect(result).toEqual({
            success: false,
            error: 'E-Mail-Adresse oder Passwort ist falsch.',
        });
        expect(userStore.error).toBe('E-Mail-Adresse oder Passwort ist falsch.');
    });
});

describe('register', () => {
    it('reports REGISTRATION_LOGIN_FAILED when the account exists but auto-login fails', async () => {
        // The extension call succeeds — the account is created and the one-time
        // activation code is consumed …
        request.mockResolvedValue({});
        // … but the follow-up login fails.
        clientLogin.mockRejectedValue({
            errors: [{ message: 'Invalid user credentials' }],
        });
        translateLoginError.mockReturnValue('E-Mail-Adresse oder Passwort ist falsch.');

        const { register } = useAuth();
        const result = await register('user@example.org', 'Passwort1', 'CODE-1234');

        expect(result).toEqual({
            success: false,
            error: '',
            code: 'REGISTRATION_LOGIN_FAILED',
        });
        // login() wrote its failure into the shared store error that LoginPage
        // renders; register must clear it so only the reason banner is shown.
        expect(userStore.error).toBeNull();
    });
});

describe('resetPassword', () => {
    it('maps an invalid or expired reset token to a German message', async () => {
        request.mockRejectedValue({
            errors: [
                {
                    message: 'Invalid user credentials.',
                    extensions: { code: 'INVALID_CREDENTIALS' },
                },
            ],
        });
        isInvalidCredentialsError.mockReturnValue(true);

        const { resetPassword } = useAuth();
        const result = await resetPassword('stale-token', 'NeuesPasswort1');

        expect(result).toEqual({
            success: false,
            error: 'Der Link zum Zurücksetzen ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.',
        });
        expect(userStore.error).toBe(
            'Der Link zum Zurücksetzen ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.',
        );
    });

    it('maps a network failure to the German offline message', async () => {
        request.mockRejectedValue(new TypeError('Failed to fetch'));
        isNetworkError.mockReturnValue(true);

        const { resetPassword } = useAuth();
        const result = await resetPassword('token', 'NeuesPasswort1');

        expect(result).toEqual({
            success: false,
            error: 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.',
        });
    });

    it('never echoes English backend text on other failures', async () => {
        request.mockRejectedValue({ errors: [{ message: 'Some English backend text' }] });

        const { resetPassword } = useAuth();
        const result = await resetPassword('token', 'NeuesPasswort1');

        expect(result).toEqual({
            success: false,
            error: 'Das Zurücksetzen des Passworts ist fehlgeschlagen. Bitte versuchen Sie es später erneut.',
        });
    });
});

describe('requestPasswordReset', () => {
    it('maps a network failure to the German offline message', async () => {
        request.mockRejectedValue(new TypeError('Failed to fetch'));
        isNetworkError.mockReturnValue(true);

        const { requestPasswordReset } = useAuth();
        const result = await requestPasswordReset('user@example.org');

        expect(result).toEqual({
            success: false,
            error: 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.',
        });
    });

    it('never echoes English backend text on other failures', async () => {
        request.mockRejectedValue({ errors: [{ message: 'Some English backend text' }] });

        const { requestPasswordReset } = useAuth();
        const result = await requestPasswordReset('user@example.org');

        expect(result).toEqual({
            success: false,
            error: 'Die E-Mail zum Zurücksetzen konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
        });
    });
});

describe('logout', () => {
    it('revokes the server session with the refresh token persisted in Dexie', async () => {
        request.mockResolvedValue({});

        const { logout } = useAuth();
        const result = await logout();

        expect(result).toEqual({ success: true });
        // The SDK's in-memory storage is empty after a reload, so the revoke must
        // carry the token the app persisted in Dexie.
        expect(request).toHaveBeenCalledWith({ refresh_token: 'old-refresh', mode: 'json' });
        expect(clearUserScopedData).toHaveBeenCalledTimes(1);
        expect(storeLogout).toHaveBeenCalledTimes(1);
        expect(favoritesClearAll).toHaveBeenCalledTimes(1);
        expect(playlistsClearAll).toHaveBeenCalledTimes(1);
        expect(preferencesResetToDefaults).toHaveBeenCalledTimes(1);
    });

    it('still logs out locally when the server revoke fails (e.g. offline)', async () => {
        request.mockRejectedValue(new Error('network down'));

        const { logout } = useAuth();
        const result = await logout();

        expect(result).toEqual({ success: true });
        expect(clearUserScopedData).toHaveBeenCalledTimes(1);
        expect(storeLogout).toHaveBeenCalledTimes(1);
        expect(favoritesClearAll).toHaveBeenCalledTimes(1);
        expect(playlistsClearAll).toHaveBeenCalledTimes(1);
        expect(preferencesResetToDefaults).toHaveBeenCalledTimes(1);
    });

    it('skips the network revoke when no refresh token is stored', async () => {
        userStore.authData = null;

        const { logout } = useAuth();
        const result = await logout();

        expect(result).toEqual({ success: true });
        expect(request).not.toHaveBeenCalled();
        expect(clearUserScopedData).toHaveBeenCalledTimes(1);
        expect(storeLogout).toHaveBeenCalledTimes(1);
    });
});

describe('deleteAccount', () => {
    const signedInUser = {
        id: 'user-1',
        email: 'user@example.org',
        role: 'activated',
        activated: true,
    };

    it('wipes local data only after the server confirmed the deletion', async () => {
        userStore.user = signedInUser;
        request.mockResolvedValue({});

        const { deleteAccount } = useAuth();
        const result = await deleteAccount();

        expect(result).toEqual({ success: true });
        // The delete must carry the Dexie-persisted session token — the SDK's
        // in-memory auth storage is empty after a page reload …
        expect(setToken).toHaveBeenCalledWith('old-access');
        // … and go through the extension's self-deletion endpoint (which also
        // releases the claimed activation code server-side).
        expect(request).toHaveBeenCalledTimes(1);
        const command = request.mock.calls[0][0] as () => {
            path: string;
            method: string;
        };
        expect(command()).toEqual({
            path: '/directus-user-register-extension/account',
            method: 'DELETE',
        });
        // The irreversible wipe + redirect happens only after the server's 2xx.
        expect(handleInvalidCredentials).toHaveBeenCalledWith('account_deleted');
    });

    it('falls back to the direct self-delete when the endpoint is not deployed', async () => {
        userStore.user = signedInUser;
        // Old extension version: Directus answers 404 ROUTE_NOT_FOUND for the
        // unknown route; the legacy deleteUser path must then still work.
        request
            .mockRejectedValueOnce({
                errors: [{ message: 'Route not found', extensions: { code: 'ROUTE_NOT_FOUND' } }],
                response: { status: 404 },
            })
            .mockResolvedValueOnce({});
        extractDirectusErrorCode.mockReturnValue('ROUTE_NOT_FOUND');

        const { deleteAccount } = useAuth();
        const result = await deleteAccount();

        expect(result).toEqual({ success: true });
        // Second request targets the own user id (deleteUser command passthrough).
        expect(request).toHaveBeenCalledTimes(2);
        expect(request).toHaveBeenLastCalledWith('user-1');
        expect(handleInvalidCredentials).toHaveBeenCalledWith('account_deleted');
    });

    it('keeps all local data when the server rejects the deletion (403)', async () => {
        userStore.user = signedInUser;
        request.mockRejectedValue({
            errors: [
                {
                    message: "You don't have permission to access this.",
                    extensions: { code: 'FORBIDDEN' },
                },
            ],
            response: { status: 403 },
        });
        extractDirectusErrorCode.mockReturnValue('FORBIDDEN');

        const { deleteAccount } = useAuth();
        const result = await deleteAccount();

        expect(result).toEqual({
            success: false,
            code: 'FORBIDDEN',
            error: expect.stringContaining('support@johannische-kirche.org'),
        });
        // Nothing local may be destroyed while the account might still exist.
        expect(handleInvalidCredentials).not.toHaveBeenCalled();
        expect(clearUserScopedData).not.toHaveBeenCalled();
        expect(storeLogout).not.toHaveBeenCalled();
    });

    it('keeps all local data on other server errors too', async () => {
        userStore.user = signedInUser;
        request.mockRejectedValue(new Error('network down'));

        const { deleteAccount } = useAuth();
        const result = await deleteAccount();

        expect(result).toEqual({
            success: false,
            code: undefined,
            error: 'Das Konto konnte nicht gelöscht werden. Bitte versuchen Sie es später erneut.',
        });
        expect(handleInvalidCredentials).not.toHaveBeenCalled();
        expect(clearUserScopedData).not.toHaveBeenCalled();
        expect(storeLogout).not.toHaveBeenCalled();
    });

    it('refuses the delete when the expired session cannot be refreshed', async () => {
        userStore.user = signedInUser;
        userStore.isTokenExpired = true;
        // The expired token forces a refresh, and that refresh fails.
        request.mockRejectedValue(new Error('refresh token rotated away'));

        const { deleteAccount } = useAuth();
        const result = await deleteAccount();

        expect(result).toEqual({
            success: false,
            error: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
        });
        // Only the refresh went out — the DELETE must never ride a stale token.
        expect(request).toHaveBeenCalledTimes(1);
        expect(request).toHaveBeenCalledWith({ refresh_token: 'old-refresh', mode: 'json' });
        expect(setToken).not.toHaveBeenCalled();
        // Nothing local may be destroyed either.
        expect(handleInvalidCredentials).not.toHaveBeenCalled();
        expect(clearUserScopedData).not.toHaveBeenCalled();
    });

    it('refuses without a real signed-in account (e.g. dev bypass)', async () => {
        userStore.user = null;

        const { deleteAccount } = useAuth();
        const result = await deleteAccount();

        expect(result).toEqual({ success: false, error: 'Sie sind nicht angemeldet.' });
        expect(request).not.toHaveBeenCalled();
        expect(handleInvalidCredentials).not.toHaveBeenCalled();
    });
});
