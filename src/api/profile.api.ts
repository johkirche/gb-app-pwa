import { readMe, updateMe } from '@directus/sdk';

import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import { directusClient } from '@/services/directus';

/**
 * Profile API
 *
 * The reader's own directus_users row: their name and symbol in Directus' own
 * fields, and the app's settings in one JSON field, `app_settings` — prefixed
 * because Directus' own `appearance` and `theme_*` fields beside it style the
 * Data Studio, not the app. Keys are English like the rest of the row:
 * `{ "accent": "gold" }`.
 *
 * Best effort throughout: nothing here throws, and nothing here may end a
 * session.
 */

export type AppSettings = Record<string, unknown>;

/** Hand the client the session token, refreshed if it is close to expiry. */
async function authorize(): Promise<boolean> {
    const userStore = useUserStore();
    if (!userStore.isLoggedIn) return false;
    if (userStore.isTokenExpired() && !(await refreshAuthToken())) return false;

    const token = userStore.authData?.accessToken;
    if (!token) return false;
    await directusClient.setToken(token);
    return true;
}

async function fetchAppSettings(): Promise<AppSettings> {
    const me = await directusClient.request(readMe({ fields: ['app_settings'] }));
    const value = (me as { app_settings?: unknown }).app_settings;
    // Anything but an object (null on a fresh account) is read as no settings.
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as AppSettings)
        : {};
}

/** The profile's settings, or null if they cannot be read. */
export async function readAppSettings(): Promise<AppSettings | null> {
    try {
        if (!(await authorize())) return null;
        return await fetchAppSettings();
    } catch (err) {
        console.warn('Could not read the app settings from the profile:', err);
        return null;
    }
}

/**
 * Who the reader says they are: the name, the symbol and the Gemeinde on their
 * row. `avatar` is Directus' own field, a file in the symbols folder
 * (config/symbols.ts) — so the Data Studio shows the same roundel beside the
 * account that the app does. `gemeinde` is ours, a many-to-one onto the
 * collection of that name.
 */
export interface Profile {
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    gemeinde: string | null;
    gemeindeName: string | null;
}

/**
 * The profile as it stands on the account, or null if it cannot be read.
 *
 * Asked for apart from the login's readMe on purpose: Directus refuses a whole
 * request that names one field the policy does not grant, and the login must
 * not hinge on whether `avatar` or `gemeinde` has been opened to readers yet.
 */
export async function readProfile(): Promise<Profile | null> {
    try {
        if (!(await authorize())) return null;
        const me = (await directusClient.request(
            readMe({
                fields: ['first_name', 'last_name', 'avatar', { gemeinde: ['id', 'name'] }],
            }),
        )) as {
            first_name?: string | null;
            last_name?: string | null;
            avatar?: unknown;
            gemeinde?: { id?: string; name?: string } | null;
        };
        return {
            firstName: me.first_name ?? null,
            lastName: me.last_name ?? null,
            // A file id; an expanded relation would be an object with one.
            avatar:
                typeof me.avatar === 'string'
                    ? me.avatar
                    : ((me.avatar as { id?: string } | null)?.id ?? null),
            // Null too for one the reader cannot see any more, such as an
            // archived Gemeinde: the policy hides its row.
            gemeinde: me.gemeinde?.id ?? null,
            gemeindeName: me.gemeinde?.name ?? null,
        };
    } catch (err) {
        console.warn('Could not read the profile:', err);
        return null;
    }
}

/**
 * Write any of the name, symbol and Gemeinde, and say whether it took. Unlike
 * the settings above this is something the reader chose and is waiting to see,
 * so the caller gets to tell them when it did not reach the server — it still
 * never throws, and never ends a session.
 */
export async function updateProfile(patch: Partial<Profile>): Promise<boolean> {
    try {
        if (!(await authorize())) return false;
        const item: Record<string, string | null> = {};
        if ('firstName' in patch) item.first_name = patch.firstName || null;
        if ('lastName' in patch) item.last_name = patch.lastName || null;
        if ('avatar' in patch) item.avatar = patch.avatar ?? null;
        if ('gemeinde' in patch) item.gemeinde = patch.gemeinde ?? null;
        await directusClient.request(
            updateMe(item as Parameters<typeof updateMe>[0], { fields: ['id'] }),
        );
        return true;
    } catch (err) {
        console.warn('Could not save the profile:', err);
        return false;
    }
}

/**
 * Set some of the profile's settings and keep the rest. Directus replaces a
 * JSON field whole, so the stored object is read first and written back with
 * the change in it; anything another version of the app put there survives.
 *
 * @returns whether it reached the profile
 */
export async function updateAppSettings(patch: AppSettings): Promise<boolean> {
    try {
        if (!(await authorize())) return false;
        const app_settings = { ...(await fetchAppSettings()), ...patch };
        // The client carries no schema, so the SDK knows only Directus' own
        // user fields; `app_settings` is ours.
        const item = { app_settings } as Parameters<typeof updateMe>[0];
        await directusClient.request(updateMe(item, { fields: ['id'] }));
        return true;
    } catch (err) {
        console.warn('Could not save the app settings to the profile:', err);
        return false;
    }
}
