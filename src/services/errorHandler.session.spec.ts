import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for what a session the server ended costs the reader.
 *
 * The rule under test: the renewal is the licence check, so a refused one closes
 * the book until a code opens it again — but nothing is taken away. The songs,
 * lists and marks stay on the device for the reader's return; the shell takes
 * them to the sign-in when the session goes (App.vue). Only a device with
 * nothing on it is reloaded into the sign-in from here.
 * Being offline never gets here: only an answer from the server does.
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
            lesezeichen: table(vi.fn(async () => undefined)),
            gelesen: table(vi.fn(async () => undefined)),
            markierungen: table(vi.fn(async () => undefined)),
            notizen: table(vi.fn(async () => undefined)),
            leseplaene: table(vi.fn(async () => undefined)),
            lists: table(vi.fn(async () => undefined)),
            listEntries: table(vi.fn(async () => undefined)),
            marks: table(vi.fn(async () => undefined)),
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

    it('ends the session over a downloaded Gesangbuch without a reload', async () => {
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

    it('sends a device with nothing downloaded to the sign-in', async () => {
        songCount.mockResolvedValue(0);
        const location = stubLocation();

        await handleInvalidCredentials('session_expired');

        expect(location.href).toBe('/anmelden?reason=session_expired');
        expect(endSession).not.toHaveBeenCalled();
    });

    it('still wipes and redirects when the account is known to be gone', async () => {
        songCount.mockResolvedValue(438);
        const location = stubLocation();

        await handleInvalidCredentials('account_deleted');

        expect(clearSongs).toHaveBeenCalled();
        expect(location.href).toBe('/anmelden?reason=account_deleted');
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

        expect(location.href).toBe('/anmelden?reason=session_expired');
    });
});
