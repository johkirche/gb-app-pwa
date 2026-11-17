import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the auth composable.
 *
 * The renewal itself, and the signing of every request, live in services/session.ts
 * and are tested in session.spec.ts.
 *
 * `login` — pins the nested role-name readMe query, the German error mapping, and
 * that an account without room for this device is reported, not failed.
 *
 * `startSession` — pins that somebody else signing in on a device whose session
 * ended clears the previous reader's lists first, and that the same reader keeps them.
 *
 * `logout` — pins that the server revoke carries the Dexie-persisted refresh token
 * and that a failed revoke (e.g. offline) still logs out locally.
 *
 * `deleteAccount` — pins that the irreversible local wipe happens ONLY after the
 * server confirmed the deletion, and never when the request fails (the initial
 * production behaviour is a 403 until the role gets delete-own permission).
 */

const request = vi.fn();
const refreshAuthToken = vi.fn();
const handleInvalidCredentials = vi.fn();
const extractDirectusErrorCode = vi.fn();
const clearUserScopedData = vi.fn();
const translateLoginError = vi.fn();
const loginWithPassword = vi.fn();
const lastAccount = vi.hoisted(() => ({ value: null as { id: string; email: string } | null }));
const rememberLastAccount = vi.fn();
const forgetLastAccount = vi.fn();
// Both default to a falsy return (vi.fn() yields undefined) — individual tests
// opt in to the invalid-credentials / network branches via mockReturnValue(true).
const isInvalidCredentialsError = vi.fn();
const isNetworkError = vi.fn();
const setUser = vi.fn();
const storeLogout = vi.fn();
const favoritesClearAll = vi.fn();
const lesezeichenClearAll = vi.fn();
const playlistsClearAll = vi.fn();
const serviceClearAll = vi.fn();
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
        isTokenExpired: (() => false) as () => boolean,
        isLoading: false,
        error: null as string | null,
        setUser: (...args: unknown[]) => setUser(...args),
        logout: (...args: unknown[]) => storeLogout(...args),
        setDevSkipAuth: vi.fn(),
    };
}
let userStore = freshUserStore();

vi.mock('@/services/directus', () => ({
    directusClient: {
        request: (...args: unknown[]) => request(...args),
    },
    directusConfig: { url: 'https://example.invalid' },
}));

vi.mock('@directus/sdk', () => ({
    // The command builders pass their input through so tests can assert exactly
    // what the composable asked the SDK to send.
    login: (payload: unknown, options: unknown) => ({ login: payload, options }),
    logout: (options: unknown) => options,
    readMe: (query: unknown) => query,
    withToken: (token: unknown, command: unknown) => ({ token, command }),
    deleteUser: (id: unknown) => id,
    passwordRequest: vi.fn(),
    passwordReset: vi.fn(),
}));

vi.mock('@/services/session', () => ({
    refreshAuthToken: (...args: unknown[]) => refreshAuthToken(...args),
}));

vi.mock('@/api/einstieg.api', () => {
    class EinstiegError extends Error {
        constructor(
            readonly code: string,
            readonly status: number,
            readonly extensions: Record<string, unknown> = {},
        ) {
            super(code);
        }
    }
    return {
        EinstiegError,
        loginWithPassword: (...args: unknown[]) => loginWithPassword(...args),
        deviceLimitOf: (error: unknown) =>
            error instanceof EinstiegError && error.code === 'DEVICE_LIMIT'
                ? error.extensions
                : null,
        describeEinstiegError: (error: { code: string }) => `German for ${error.code}`,
    };
});

vi.mock('@/services/lastAccount', () => ({
    readLastAccount: () => lastAccount.value,
    rememberLastAccount: (...args: unknown[]) => rememberLastAccount(...args),
    forgetLastAccount: (...args: unknown[]) => forgetLastAccount(...args),
}));

vi.mock('@/services/errorHandler', () => ({
    handleInvalidCredentials: (...args: unknown[]) => handleInvalidCredentials(...args),
    isInvalidCredentialsError: (...args: unknown[]) => isInvalidCredentialsError(...args),
    isNetworkError: (...args: unknown[]) => isNetworkError(...args),
    clearUserScopedData: (...args: unknown[]) => clearUserScopedData(...args),
    translateLoginError: (...args: unknown[]) => translateLoginError(...args),
    extractDirectusErrorCode: (...args: unknown[]) => extractDirectusErrorCode(...args),
    NETWORK_ERROR_MESSAGE: 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.',
}));

vi.mock('@/stores/user', () => ({
    useUserStore: () => userStore,
}));

// The content stores are mocked so importing useAuth never pulls '@/db' (Dexie)
// into jsdom; the vi.fn()s let the logout tests assert the resets happened.
vi.mock('@/stores/favorites', () => ({
    useFavoritesStore: () => ({ clearAll: (...args: unknown[]) => favoritesClearAll(...args) }),
}));

vi.mock('@/stores/lesezeichen', () => ({
    useLesezeichenStore: () => ({
        clearAll: (...args: unknown[]) => lesezeichenClearAll(...args),
    }),
}));

vi.mock('@/stores/playlists', () => ({
    usePlaylistsStore: () => ({ clearAll: (...args: unknown[]) => playlistsClearAll(...args) }),
}));

vi.mock('@/stores/service', () => ({
    useServiceStore: () => ({ clearAll: (...args: unknown[]) => serviceClearAll(...args) }),
}));

vi.mock('@/stores/preferences', () => ({
    usePreferencesStore: () => ({
        resetToDefaults: (...args: unknown[]) => preferencesResetToDefaults(...args),
    }),
}));

// Imported after the mocks so the module picks them up.
const { useAuth } = await import('./useAuth');
const { EinstiegError } = await import('@/api/einstieg.api');

beforeEach(() => {
    vi.resetAllMocks();
    userStore = freshUserStore();
    lastAccount.value = null;
});

const SESSION = {
    access_token: 'new-access',
    refresh_token: 'new-refresh',
    expires: 900000,
    refresh_expires: 1_800_000_000_000,
};
const ME = {
    id: 'user-1',
    email: 'user@example.org',
    first_name: 'Erika',
    last_name: 'Muster',
    role: { name: 'activated' },
};

describe('login', () => {
    it('requests the nested role name and maps it onto the stored user', async () => {
        loginWithPassword.mockResolvedValue(SESSION);
        request.mockResolvedValueOnce(ME);

        const { login } = useAuth();
        const result = await login('user@example.org', 'Passwort1');

        expect(result.success).toBe(true);
        expect(loginWithPassword).toHaveBeenCalledWith('user@example.org', 'Passwort1');
        // There is no session yet to sign with, so the user is asked for with the
        // token just issued. A bare 'role' field would return the role UUID; the
        // nested selection is what makes the activation check below possible.
        expect(request).toHaveBeenCalledWith({
            token: 'new-access',
            command: expect.objectContaining({
                fields: expect.arrayContaining([{ role: ['name'] }]),
            }),
        });
        expect(setUser).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'user-1', role: 'activated', activated: true }),
            expect.objectContaining({
                accessToken: 'new-access',
                refreshToken: 'new-refresh',
                refreshExpiresAt: 1_800_000_000_000,
            }),
        );
        expect(rememberLastAccount).toHaveBeenCalledWith({
            id: 'user-1',
            email: 'user@example.org',
            firstName: 'Erika',
        });
    });

    it('returns the German message when the extension refuses', async () => {
        loginWithPassword.mockRejectedValue(new EinstiegError('INVALID_CREDENTIALS', 401));

        const { login } = useAuth();
        const result = await login('user@example.org', 'falsch');

        expect(result).toEqual({ success: false, error: 'German for INVALID_CREDENTIALS' });
        expect(userStore.error).toBe('German for INVALID_CREDENTIALS');
        expect(setUser).not.toHaveBeenCalled();
    });

    it('falls back to the Directus mapping for anything else', async () => {
        const sdkError = { errors: [{ message: 'Invalid user credentials' }] };
        loginWithPassword.mockRejectedValue(sdkError);
        translateLoginError.mockReturnValue('E-Mail-Adresse oder Passwort ist falsch.');

        const { login } = useAuth();
        const result = await login('user@example.org', 'falsch');

        expect(translateLoginError).toHaveBeenCalledWith(sdkError);
        expect(result).toEqual({
            success: false,
            error: 'E-Mail-Adresse oder Passwort ist falsch.',
        });
    });

    it('reports an account without room for this device, with what to offer', async () => {
        const limit = { limit: 4, devices: [{ id: 1, name: 'iPhone · Safari' }], ticket: 't' };
        loginWithPassword.mockRejectedValue(new EinstiegError('DEVICE_LIMIT', 409, limit));

        const { login } = useAuth();
        const result = await login('user@example.org', 'Passwort1');

        expect(result).toEqual({ success: false, error: '', deviceLimit: limit });
        expect(userStore.error).toBeNull();
    });
});

describe('startSession', () => {
    it('keeps the lists of the reader who comes back', async () => {
        lastAccount.value = { id: 'user-1', email: 'user@example.org' };
        request.mockResolvedValueOnce(ME);

        await useAuth().startSession(SESSION);

        expect(clearUserScopedData).not.toHaveBeenCalled();
        expect(setUser).toHaveBeenCalledOnce();
    });

    it("clears the previous reader's lists before somebody else signs in", async () => {
        lastAccount.value = { id: 'someone-else', email: 'other@example.org' };
        request.mockResolvedValueOnce(ME);
        const order: string[] = [];
        clearUserScopedData.mockImplementation(async () => void order.push('cleared'));
        setUser.mockImplementation(async () => void order.push('signed in'));

        await useAuth().startSession(SESSION);

        expect(order).toEqual(['cleared', 'signed in']);
        expect(playlistsClearAll).toHaveBeenCalled();
        expect(preferencesResetToDefaults).toHaveBeenCalled();
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
        // The revoke names the session by the refresh token the app persisted.
        expect(request).toHaveBeenCalledWith({ refresh_token: 'old-refresh', mode: 'json' });
        expect(clearUserScopedData).toHaveBeenCalledTimes(1);
        expect(storeLogout).toHaveBeenCalledTimes(1);
        expect(favoritesClearAll).toHaveBeenCalledTimes(1);
        expect(lesezeichenClearAll).toHaveBeenCalledTimes(1);
        expect(playlistsClearAll).toHaveBeenCalledTimes(1);
        expect(serviceClearAll).toHaveBeenCalledTimes(1);
        expect(preferencesResetToDefaults).toHaveBeenCalledTimes(1);
        // Leaving on purpose: the next sign-in on this device is nobody's return.
        expect(forgetLastAccount).toHaveBeenCalledTimes(1);
    });

    it('still logs out locally when the server revoke fails (e.g. offline)', async () => {
        request.mockRejectedValue(new Error('network down'));

        const { logout } = useAuth();
        const result = await logout();

        expect(result).toEqual({ success: true });
        expect(clearUserScopedData).toHaveBeenCalledTimes(1);
        expect(storeLogout).toHaveBeenCalledTimes(1);
        expect(favoritesClearAll).toHaveBeenCalledTimes(1);
        expect(lesezeichenClearAll).toHaveBeenCalledTimes(1);
        expect(playlistsClearAll).toHaveBeenCalledTimes(1);
        expect(serviceClearAll).toHaveBeenCalledTimes(1);
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
        // The delete goes through the extension's self-deletion endpoint (which
        // also releases the claimed activation code server-side).
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
        userStore.isTokenExpired = () => true;
        // The expired token forces a refresh, and that refresh fails.
        refreshAuthToken.mockResolvedValue(false);

        const { deleteAccount } = useAuth();
        const result = await deleteAccount();

        expect(result).toEqual({
            success: false,
            error: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
        });
        // The DELETE must never ride a stale token.
        expect(refreshAuthToken).toHaveBeenCalledOnce();
        expect(request).not.toHaveBeenCalled();
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
