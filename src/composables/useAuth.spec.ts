import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the refresh-token race.
 *
 * Directus rotates refresh tokens, so a second `/auth/refresh` sent with an
 * already-consumed token fails. The download loop runs 5 file fetches at a time, and
 * before the in-flight promise was shared every one of them fired its own refresh —
 * four failed, and the resulting INVALID_CREDENTIALS wiped the user's whole offline
 * library. These tests pin the "exactly one request" behaviour in place.
 */

const request = vi.fn();
const handleApiError = vi.fn();
const updateTokens = vi.fn();

vi.mock('@/services/directus', () => ({
    directusClient: {
        request: (...args: unknown[]) => request(...args),
    },
    directusConfig: { url: 'https://example.invalid' },
}));

vi.mock('@directus/sdk', () => ({
    refresh: (payload: unknown) => payload,
    passwordRequest: vi.fn(),
    passwordReset: vi.fn(),
    readMe: vi.fn(),
}));

vi.mock('@/services/errorHandler', () => ({
    handleApiError: (...args: unknown[]) => handleApiError(...args),
    isInvalidCredentialsError: () => false,
    extractDirectusErrorCode: vi.fn(),
    extractDirectusErrorMessage: vi.fn(),
    translateRegistrationError: vi.fn(),
}));

vi.mock('@/stores/user', () => ({
    useUserStore: () => ({
        authData: { accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: 0 },
        updateTokens: (...args: unknown[]) => updateTokens(...args),
    }),
}));

// Imported after the mocks so the module picks them up.
const { refreshAuthToken } = await import('./useAuth');

describe('refreshAuthToken', () => {
    beforeEach(() => {
        request.mockReset();
        handleApiError.mockReset();
        updateTokens.mockReset();
    });

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
