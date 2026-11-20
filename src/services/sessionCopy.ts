import type { AuthData, UserData } from '@/db';

/**
 * A copy of the session in localStorage, beside the one in IndexedDB.
 *
 * A phone that runs short of space has Chrome empty the storage it may take
 * back — IndexedDB, the caches, the worker — of every site whose storage is not
 * persistent (services/storage, requestPersistentStorage). localStorage is not
 * among it, and stays. Without this copy the reader opened the app to find
 * themselves signed out and the book gone, every time the phone filled up; seen
 * on a phone that did so every quarter of an hour, which kept one device id
 * through all of it (2026-11-19). With it they stay signed in, and the book comes
 * back down by itself (libraryUpdates).
 *
 * The copy is the same tokens as the database holds, readable by the same code
 * on the same origin, so it opens nothing that was closed. It is kept in step on
 * every save, and goes wherever the session goes: logout, an ended session, a
 * deleted account. The symbol's picture stays out — it is the one large field,
 * and pullProfile fetches a missing one.
 */

const KEY = 'gesangbuch.sitzung';

interface SessionCopy {
    user: UserData;
    auth: AuthData;
}

let restored = false;

export function keepSessionCopy(user: UserData | null, auth: AuthData | null): void {
    if (!user || !auth) return;
    const { avatarSvg: _picture, ...rest } = user;
    try {
        localStorage.setItem(KEY, JSON.stringify({ user: rest, auth }));
    } catch {
        // No storage, or none to spare: the database's copy is all there is.
    }
}

/** The copy, or null when there is none or it is not one this app wrote. */
export function readSessionCopy(): SessionCopy | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const copy = JSON.parse(raw) as Partial<SessionCopy> | null;
        const { user, auth } = copy ?? {};
        if (
            typeof user?.id !== 'string' ||
            typeof auth?.accessToken !== 'string' ||
            typeof auth.refreshToken !== 'string' ||
            typeof auth.expiresAt !== 'number'
        ) {
            return null;
        }
        return { user, auth: { ...auth, id: 'current' } };
    } catch {
        return null;
    }
}

export function forgetSessionCopy(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // Nothing to forget without storage.
    }
}

/** Note that this start found the database emptied and took the session from the copy. */
export function noteRestoredFromCopy(): void {
    restored = true;
}

/** Whether it did: the book on this device was taken with it, and should come back down. */
export function wasRestoredFromCopy(): boolean {
    return restored;
}
