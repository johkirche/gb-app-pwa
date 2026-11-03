import {
    type AuthenticationData,
    type RestCommand,
    authentication,
    createDirectus,
    graphql,
    rest,
    withOptions,
} from '@directus/sdk';

import { directusConfig } from '@/config/directus';

/**
 * Directus Service
 *
 * Simple service that initializes and exports the Directus client.
 * All domain-specific logic (songs, files, auth) should be in separate modules.
 */

/**
 * What the SDK may remember of the session: the access token, and nothing else.
 *
 * The session is the app's — in the user store, persisted in IndexedDB — and the
 * app refreshes it itself (refreshAuthToken in useAuth). Left to its defaults the
 * SDK keeps a second copy and refreshes that on its own: `login()` arms a timer
 * for 30 s before the access token runs out, and `getToken()` refreshes before
 * any request once the stored expiry is near. Directus rotates the refresh token
 * on every refresh, so from that moment the copy in IndexedDB is dead, and the
 * app's next refresh ends the session — „Ihre Sitzung ist abgelaufen" a quarter
 * of an hour after signing in, whenever nothing asked the server anything in
 * between.
 *
 * So the SDK gets no timer (`autoRefresh: false`) and a storage with no refresh
 * token and no expiry in it: nothing to refresh with, and nothing that says when.
 * It still carries the access token the app hands it (`setToken`, and the one
 * `login()` returns) on every request.
 */
function accessTokenOnly() {
    let accessToken: string | null = null;
    return {
        get: (): AuthenticationData => ({
            access_token: accessToken,
            refresh_token: null,
            expires: null,
            expires_at: null,
        }),
        set: (data: AuthenticationData | null) => {
            accessToken = data?.access_token ?? null;
        },
    };
}

// Initialize Directus client
const client = createDirectus(directusConfig.url)
    .with(graphql())
    .with(rest())
    .with(authentication('json', { autoRefresh: false, storage: accessTokenOnly() }));

// Export client for use in API modules and composables
export const directusClient = client;

/**
 * A command sent without the access token the client would otherwise attach.
 *
 * For /auth/refresh and /auth/logout. Directus checks a bearer token before it
 * routes a request, /auth included, so an expired one fails the refresh with
 * TOKEN_EXPIRED before the refresh token in the body is even read — and the
 * token in hand is expired exactly when a refresh is overdue. The refresh token
 * is the whole credential there; the header only gets in its way.
 */
export function withoutAccessToken<Output, Schema>(
    command: RestCommand<Output, Schema>,
): RestCommand<Output, Schema> {
    return withOptions(command, (options) => {
        const { Authorization: _, ...headers } = (options.headers ?? {}) as Record<string, string>;
        return { ...options, headers };
    });
}

// Export config for URL access
export { directusConfig };
