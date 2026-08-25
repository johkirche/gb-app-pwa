import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for what an expired session costs the reader.
 *
 * The rule under test: a device that holds a downloaded Gesangbuch is never sent
 * to the login form over a token. Sessions lapse offline, where signing back in
 * is not even possible — taking the book away there would leave a hymnal that
 * locks itself. Only a device with nothing to read has anywhere else to go.
 *
 * Its own file rather than a block in errorHandler.spec.ts: these need a Dexie
 * stub with real tables, and that file deliberately stubs the db away entirely.
 */

const songCount = vi.fn<() => Promise<number>>();
const clearAuth = vi.fn(async () => undefined);
const clearUsers = vi.fn(async () => undefined);
const clearSongs = vi.fn(async () => undefined);
const endSession = vi.fn();

vi.mock('@/db', () => {
    const table = (clear: () => Promise<undefined>) => ({ clear, name: 'stub' });
    return {
        db: {
            songs: { clear: clearSongs, count: () => songCount(), name: 'songs' },
            auth: table(clearAuth),
            users: table(clearUsers),
            files: table(vi.fn(async () => undefined)),
            playlists: table(vi.fn(async () => undefined)),
            preferences: table(vi.fn(async () => undefined)),
            favorites: table(vi.fn(async () => undefined)),
            services: table(vi.fn(async () => undefined)),
            meta: table(vi.fn(async () => undefined)),
            transaction: (
                _mode: string,
                _tables: unknown,
                run: () => Promise<void> | void = () => undefined,
            ) => run(),
        },
    };
});

vi.mock('@/stores/user', () => ({ useUserStore: () => ({ endSession }) }));

const { handleInvalidCredentials } = await import('./errorHandler');

/** jsdom refuses a real navigation, so the assignment is captured instead. */
function stubLocation(): { href: string } {
    const location = { href: '' };
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: location,
    });
    return location;
}

describe('handleInvalidCredentials', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps a reader with a downloaded Gesangbuch in the app', async () => {
        songCount.mockResolvedValue(438);
        const location = stubLocation();

        await handleInvalidCredentials('session_expired');

        expect(location.href).toBe('');
        expect(endSession).toHaveBeenCalledTimes(1);
    });

    it('clears the dead session without touching the songs', async () => {
        songCount.mockResolvedValue(438);
        stubLocation();

        await handleInvalidCredentials('session_expired');

        expect(clearAuth).toHaveBeenCalled();
        expect(clearUsers).toHaveBeenCalled();
        expect(clearSongs).not.toHaveBeenCalled();
    });

    it('sends a device with nothing downloaded to the login page', async () => {
        songCount.mockResolvedValue(0);
        const location = stubLocation();

        await handleInvalidCredentials('session_expired');

        expect(location.href).toBe('/login?reason=session_expired');
        expect(endSession).not.toHaveBeenCalled();
    });

    it('still wipes and redirects when the account is known to be gone', async () => {
        songCount.mockResolvedValue(438);
        const location = stubLocation();

        await handleInvalidCredentials('account_deleted');

        expect(clearSongs).toHaveBeenCalled();
        expect(location.href).toBe('/login?reason=account_deleted');
    });

    it('treats an unreadable library as nothing to stay for', async () => {
        songCount.mockRejectedValue(new Error('IndexedDB unavailable'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const location = stubLocation();

        try {
            await handleInvalidCredentials('session_expired');
        } finally {
            consoleError.mockRestore();
        }

        expect(location.href).toBe('/login?reason=session_expired');
    });
});
