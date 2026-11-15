import { useUserStore } from '@/stores/user';

import { directusConfig } from '@/config/directus';
import { SESSION_ENDED_ERROR, handleInvalidCredentials } from '@/services/errorHandler';

/**
 * The session, in the one place every request to Directus passes through.
 *
 * `sessionFetch` is the Directus client's fetch, and what the API modules call
 * for the few requests they send by hand. Whatever goes through it is signed and
 * kept signed without the caller doing anything:
 *
 *  - The access token goes on from the user store, renewed first when it is
 *    about to run out.
 *  - A 401 renews it and asks once more: the token may have run out after all,
 *    or another tab may have renewed it underneath this one.
 *  - Only a renewal the server turns down ends the session. The request then
 *    rejects with SESSION_ENDED_ERROR, so the caller can tell "the session went"
 *    from "the request failed" (`isSessionEndedError`). A renewal that fails on
 *    the network ends nothing; the request fails as requests do offline.
 *  - /auth requests go out exactly as they were made. Directus checks a bearer
 *    before it routes a request, /auth/refresh included, so a dead access token
 *    sent along with a renewal has it refused before its refresh token is looked
 *    at. That ended every session a quarter of an hour into a pause, and is why
 *    the client carries no `authentication()` of its own to put one on.
 *
 * A request that brings its own Authorization is left alone too: the login asks
 * for the user with the token it has just been given, before any session exists.
 */

/** Directus' origin and base path, to tell its requests from anybody else's. */
const backend = new URL(directusConfig.url);
const backendPath = backend.pathname.replace(/\/$/, '');

type Kind = 'session' | 'auth' | 'elsewhere';

function kindOf(input: string | URL): Kind {
    const url = new URL(input, backend);
    if (url.origin !== backend.origin || !url.pathname.startsWith(`${backendPath}/`)) {
        return 'elsewhere';
    }
    return url.pathname.startsWith(`${backendPath}/auth/`) ? 'auth' : 'session';
}

function withBearer(init: RequestInit, token: string): RequestInit {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return { ...init, headers };
}

function sessionEnded(): Error {
    return new Error(SESSION_ENDED_ERROR);
}

/** fetch, for anything sent to Directus. See the top of this module. */
export async function sessionFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    if (kindOf(input) !== 'session' || new Headers(init.headers).has('Authorization')) {
        return fetch(input, init);
    }

    const user = useUserStore();
    // No session to sign with (signed out, a demo, the dev bypass): ask as nobody.
    if (!user.authData) return fetch(input, init);

    if (user.isTokenExpired()) await refreshAuthToken();
    if (!user.authData) throw sessionEnded();

    const response = await fetch(input, withBearer(init, user.authData.accessToken));
    if (response.status !== 401) return response;

    if (await refreshAuthToken()) {
        return fetch(input, withBearer(init, user.authData!.accessToken));
    }
    if (!user.authData) throw sessionEnded();
    return response;
}

/**
 * The single in-flight refresh, or null when none is running.
 *
 * Directus rotates refresh tokens: the first `/auth/refresh` invalidates the token it
 * was called with. The download loop fetches files in batches of 5 concurrently, and
 * every one of them would otherwise renew with the *same* stored refresh token — one
 * wins and the other four are refused, which used to take the whole offline library
 * down with it. Sharing one promise makes the refresh happen exactly once no matter
 * how many callers race for it.
 */
let inFlightRefresh: Promise<boolean> | null = null;

/**
 * The same race across tabs, where that promise is no help: each tab has its own, and
 * all of them share one refresh token through the database. So a renewal also holds a
 * lock the browser keeps for the whole origin, and a tab that waited for it finds the
 * new tokens in the database, with nothing left to ask the server.
 */
const REFRESH_LOCK = 'gesangbuch.token-refresh';

function whileHoldingRefreshLock(renew: () => Promise<boolean>): Promise<boolean> {
    // There is no lock to take on an insecure origin, such as a phone testing against
    // a dev machine's address. That leaves the race, not the app, without it.
    return navigator.locks ? navigator.locks.request(REFRESH_LOCK, renew) : renew();
}

/** What a refresh the server turned down rejects with, to end the session over. */
class RefreshRefused extends Error {}

async function renewTokens(): Promise<boolean> {
    const user = useUserStore();

    if ((await user.adoptStoredTokens()) && !user.isTokenExpired()) {
        return true;
    }

    const refreshToken = user.authData?.refreshToken;
    if (!refreshToken) return false;

    const response = await fetch(`${directusConfig.url}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
    });

    // Directus answers a refresh token it does not know, or no longer knows, with
    // 401 INVALID_CREDENTIALS. Anything else says nothing about the session.
    if (response.status === 401) throw new RefreshRefused();
    if (!response.ok) return false;

    const { data } = (await response.json()) as {
        data?: { access_token?: string; refresh_token?: string; expires?: number };
    };
    if (!data?.access_token || !data.refresh_token) return false;

    await user.updateTokens(
        data.access_token,
        data.refresh_token,
        Date.now() + (data.expires || 900000),
    );
    return true;
}

async function performRefresh(): Promise<boolean> {
    try {
        return await whileHoldingRefreshLock(renewTokens);
    } catch (error) {
        console.error('Error refreshing token:', error);

        // A refused refresh means this session is over — it does NOT mean the account
        // was deleted, so this must not destroy the reader's songs or playlists.
        if (error instanceof RefreshRefused) {
            await handleInvalidCredentials('session_expired');
        }
        return false;
    }
}

/**
 * Renew the session's tokens. Concurrent callers share a single network refresh;
 * all of them resolve with the result of that one request.
 *
 * @returns whether there is a fresh access token now. False either way when there
 *          is not: the session is over if `authData` has gone with it, and merely
 *          unrenewed (offline, a server error) if it has not.
 */
export function refreshAuthToken(): Promise<boolean> {
    inFlightRefresh ??= performRefresh().finally(() => {
        inFlightRefresh = null;
    });
    return inFlightRefresh;
}
