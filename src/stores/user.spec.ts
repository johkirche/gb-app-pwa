import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * How the store judges the tokens it holds. `isTokenExpired` was a computed once, which
 * looks again only when authData changes, not when the clock does: it kept its first
 * answer for as long as the app stayed open, and every request after a quarter of an
 * hour went out with a dead token.
 */

const storedAuth = vi.fn();

vi.mock('@/db', () => ({
    db: {
        auth: { toArray: () => storedAuth() },
        users: { toArray: () => Promise.resolve([]) },
    },
}));

const { useUserStore } = await import('./user');

const MINUTE = 60 * 1000;

function tokens(refreshToken: string, expiresIn = 15 * MINUTE) {
    return {
        id: 'current',
        accessToken: `access-of-${refreshToken}`,
        refreshToken,
        expiresAt: Date.now() + expiresIn,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    storedAuth.mockResolvedValue([]);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('isTokenExpired', () => {
    it('notices the token running out while the app stands open', () => {
        const store = useUserStore();
        store.authData = tokens('first');
        expect(store.isTokenExpired()).toBe(false);

        vi.advanceTimersByTime(20 * MINUTE);
        expect(store.isTokenExpired()).toBe(true);
    });

    it('counts a token as expired five minutes early', () => {
        const store = useUserStore();
        store.authData = tokens('first', 15 * MINUTE);

        vi.advanceTimersByTime(9 * MINUTE);
        expect(store.isTokenExpired()).toBe(false);
        vi.advanceTimersByTime(MINUTE);
        expect(store.isTokenExpired()).toBe(true);
    });

    it('looks again at a renewed token', () => {
        const store = useUserStore();
        store.authData = tokens('first');
        vi.advanceTimersByTime(20 * MINUTE);
        expect(store.isTokenExpired()).toBe(true);

        store.authData = tokens('second');
        expect(store.isTokenExpired()).toBe(false);
    });

    it('counts no session as expired', () => {
        expect(useUserStore().isTokenExpired()).toBe(true);
    });
});

describe('adoptStoredTokens', () => {
    it('takes up a pair another tab has renewed', async () => {
        const store = useUserStore();
        store.authData = tokens('first');
        const renewed = tokens('second');
        storedAuth.mockResolvedValue([renewed]);

        expect(await store.adoptStoredTokens()).toBe(true);
        expect(store.authData).toEqual(renewed);
    });

    it('has nothing to take up when the database holds the same pair', async () => {
        const store = useUserStore();
        store.authData = tokens('first');
        storedAuth.mockResolvedValue([tokens('first')]);

        expect(await store.adoptStoredTokens()).toBe(false);
    });

    it('keeps its pair when the database holds none', async () => {
        const store = useUserStore();
        const own = tokens('first');
        store.authData = own;

        expect(await store.adoptStoredTokens()).toBe(false);
        expect(store.authData).toEqual(own);
    });

    it('does not start a session on a tab whose session has ended', async () => {
        const store = useUserStore();
        storedAuth.mockResolvedValue([tokens('second')]);

        expect(await store.adoptStoredTokens()).toBe(false);
        expect(store.authData).toBeNull();
    });
});
