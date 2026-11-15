import { createDirectus, graphql, rest } from '@directus/sdk';

import { directusConfig } from '@/config/directus';
import { sessionFetch } from '@/services/session';

/**
 * Directus Service
 *
 * Simple service that initializes and exports the Directus client.
 * All domain-specific logic (songs, files, auth) should be in separate modules.
 *
 * The client signs nothing itself: there is no `authentication()` on it, so it
 * holds no token and renews none. Every request goes out through `sessionFetch`,
 * which signs it with the session's token and keeps that token alive (see
 * services/session.ts).
 */
const client = createDirectus(directusConfig.url, { globals: { fetch: sessionFetch } })
    .with(graphql())
    .with(rest());

// Export client for use in API modules and composables
export const directusClient = client;

// Export config for URL access
export { directusConfig };
