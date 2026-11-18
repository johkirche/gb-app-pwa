/**
 * Whose the reading on this device is, kept past the end of their session.
 *
 * When a session ends underneath a reader (thirty days without the server, or
 * the device signed out from another one), their songs, lists and marks stay
 * and the app asks for a code before it opens again. This is what lets it greet
 * them by name and send the code to the address it already knows, and what
 * tells it, when somebody else signs in instead, that the lists and marks on
 * the device are not theirs.
 *
 * Gone with an explicit logout, which takes the personal data with it.
 */

export interface LastAccount {
    id: string;
    email: string;
    firstName?: string;
}

const KEY = 'gesangbuch.letztesKonto';

export function readLastAccount(): LastAccount | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<LastAccount>;
        if (typeof value.id !== 'string' || typeof value.email !== 'string') return null;
        return {
            id: value.id,
            email: value.email,
            ...(typeof value.firstName === 'string' && value.firstName
                ? { firstName: value.firstName }
                : {}),
        };
    } catch {
        return null;
    }
}

export function rememberLastAccount(account: LastAccount): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(account));
    } catch {
        // Without storage the next sign-in simply asks for the address.
    }
}

export function forgetLastAccount(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // Nothing to forget.
    }
}
