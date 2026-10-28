import { readMe, updateMe } from '@directus/sdk';

import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import { directusClient } from '@/services/directus';

/**
 * Profile API
 *
 * The reader's own settings on their directus_users row, in one JSON field,
 * `app_settings` — prefixed because Directus' own `appearance` and `theme_*`
 * fields beside it style the Data Studio, not the app. Keys are English like
 * the rest of the row: `{ "accent": "gold" }`.
 *
 * Best effort throughout: a setting that does not reach the profile still
 * holds on this device, so nothing here throws, and nothing here may end a
 * session.
 */

export type AppSettings = Record<string, unknown>;

/** Hand the client the session token, refreshed if it is close to expiry. */
async function authorize(): Promise<boolean> {
    const userStore = useUserStore();
    if (!userStore.isLoggedIn) return false;
    if (userStore.isTokenExpired && !(await refreshAuthToken())) return false;

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
 * Set some of the profile's settings and keep the rest. Directus replaces a
 * JSON field whole, so the stored object is read first and written back with
 * the change in it; anything another version of the app put there survives.
 */
export async function updateAppSettings(patch: AppSettings): Promise<void> {
    try {
        if (!(await authorize())) return;
        const app_settings = { ...(await fetchAppSettings()), ...patch };
        // The client carries no schema, so the SDK knows only Directus' own
        // user fields; `app_settings` is ours.
        const item = { app_settings } as Parameters<typeof updateMe>[0];
        await directusClient.request(updateMe(item, { fields: ['id'] }));
    } catch (err) {
        console.warn('Could not save the app settings to the profile:', err);
    }
}
