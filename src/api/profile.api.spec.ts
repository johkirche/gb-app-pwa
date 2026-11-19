import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Whether an account has been through the onboarding, and the mark that says
 * so. The SDK's command builders pass their input through, so each request
 * here is the query the profile API asked Directus for.
 */

const request = vi.fn();
let loggedIn = true;

vi.mock('@directus/sdk', () => ({
    readMe: (query: { fields: unknown[] }) => ({ readMe: query }),
    updateMe: (item: unknown) => ({ updateMe: item }),
}));
vi.mock('@/services/directus', () => ({
    directusClient: { request: (...args: unknown[]) => request(...args) },
}));
vi.mock('@/stores/user', () => ({
    useUserStore: () => ({
        get isLoggedIn() {
            return loggedIn;
        },
    }),
}));

const { markOnboarded, readOnboarded } = await import('./profile.api');

beforeEach(() => {
    request.mockReset();
    loggedIn = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('readOnboarded', () => {
    it('is true for an account with the mark', async () => {
        request.mockResolvedValue({ app_settings: { onboarded: '2026-11-19T20:41:00.000Z' } });
        expect(await readOnboarded()).toBe(true);
    });

    // Finished before the mark existed: the symbol and the Gemeinde are only
    // ever chosen in the onboarding or the Einstellungen, never on the way in.
    it.each([
        ['a symbol', { avatar: 'file-1' }],
        ['a Gemeinde', { gemeinde: 'gemeinde-1' }],
    ])('is true for an account without the mark but with %s', async (_, profile) => {
        request.mockResolvedValue({ app_settings: null, avatar: null, gemeinde: null, ...profile });
        expect(await readOnboarded()).toBe(true);
    });

    it('is false for a fresh account', async () => {
        request.mockResolvedValue({ app_settings: null, avatar: null, gemeinde: null });
        expect(await readOnboarded()).toBe(false);
    });

    it('is false for an account with settings but none of the three', async () => {
        request.mockResolvedValue({ app_settings: { synced: {} }, avatar: null, gemeinde: null });
        expect(await readOnboarded()).toBe(false);
    });

    // The whole onboarding is the safe way round.
    it('is false when the profile cannot be read', async () => {
        request.mockRejectedValue(new Error('offline'));
        expect(await readOnboarded()).toBe(false);
    });

    it('asks nothing without a session', async () => {
        loggedIn = false;
        expect(await readOnboarded()).toBe(false);
        expect(request).not.toHaveBeenCalled();
    });
});

describe('markOnboarded', () => {
    it('adds the mark and keeps the settings beside it', async () => {
        const synced = { theme: { v: 'dark', at: '2026-11-01T00:00:00.000Z' } };
        request.mockResolvedValue({ app_settings: { synced } });

        await markOnboarded();

        const write = request.mock.calls.find(([cmd]) => 'updateMe' in cmd)?.[0] as {
            updateMe: { app_settings: Record<string, unknown> };
        };
        expect(write.updateMe.app_settings.synced).toEqual(synced);
        expect(typeof write.updateMe.app_settings.onboarded).toBe('string');
    });

    it('keeps the first mark rather than writing a later one', async () => {
        request.mockResolvedValue({ app_settings: { onboarded: '2026-01-01T00:00:00.000Z' } });

        await markOnboarded();

        expect(request.mock.calls.some(([cmd]) => 'updateMe' in cmd)).toBe(false);
    });

    it('writes nothing when the settings cannot be read', async () => {
        request.mockRejectedValue(new Error('offline'));

        await markOnboarded();

        expect(request).toHaveBeenCalledOnce();
    });
});
