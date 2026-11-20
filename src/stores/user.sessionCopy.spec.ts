import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db';
import { clearSessionData } from '@/services/errorHandler';

/**
 * The session's copy in localStorage (services/sessionCopy), over a real
 * IndexedDB: what a start finds when the browser emptied the database and left
 * localStorage, and that the copy goes wherever the session goes.
 */

const { useUserStore } = await import('./user');
const { readSessionCopy, wasRestoredFromCopy } = await import('@/services/sessionCopy');

const USER = { id: 'u1', email: 'leser@example.invalid', role: 'activated', activated: true };
const TOKENS = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 15 * 60_000,
};

async function signIn() {
    const store = useUserStore();
    await store.initPromise;
    await store.setUser({ ...USER, avatarSvg: '<svg/>' }, TOKENS);
    return store;
}

/** A cold start on the same device: a new store over what storage holds now. */
async function coldStart() {
    setActivePinia(createPinia());
    const store = useUserStore();
    await store.initPromise;
    return store;
}

/** What Chrome does when the phone runs short of space. */
async function evictIndexedDb() {
    await db.auth.clear();
    await db.users.clear();
}

beforeEach(async () => {
    localStorage.clear();
    await evictIndexedDb();
    setActivePinia(createPinia());
});

describe('the session copy', () => {
    it('is kept in step with the session, without the symbol’s picture', async () => {
        await signIn();

        const copy = readSessionCopy();
        expect(copy?.auth.refreshToken).toBe('refresh');
        expect(copy?.user.id).toBe('u1');
        expect(copy?.user).not.toHaveProperty('avatarSvg');
    });

    it('follows a renewal', async () => {
        const store = await signIn();
        await store.updateTokens('access-2', 'refresh-2', Date.now() + 15 * 60_000);

        expect(readSessionCopy()?.auth.refreshToken).toBe('refresh-2');
    });

    it('brings the session back when IndexedDB was emptied', async () => {
        await signIn();
        await evictIndexedDb();

        const store = await coldStart();

        expect(store.isLoggedIn).toBe(true);
        expect(store.authData?.refreshToken).toBe('refresh');
        expect(wasRestoredFromCopy()).toBe(true);
        // And into the database again, where the rest of the app reads it.
        expect((await db.auth.toArray())[0]?.refreshToken).toBe('refresh');
        expect((await db.users.toArray())[0]?.id).toBe('u1');
    });

    it('goes with a logout', async () => {
        const store = await signIn();
        await store.logout();

        expect(readSessionCopy()).toBeNull();
        expect((await coldStart()).isLoggedIn).toBe(false);
    });

    it('goes with a session the server ended', async () => {
        await signIn();
        await clearSessionData();

        expect(readSessionCopy()).toBeNull();
        expect((await coldStart()).isLoggedIn).toBe(false);
    });

    it('is ignored when it is not one the app wrote', async () => {
        localStorage.setItem('gesangbuch.sitzung', JSON.stringify({ user: { id: 1 } }));

        expect((await coldStart()).isLoggedIn).toBe(false);
    });
});
