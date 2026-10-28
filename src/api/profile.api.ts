import { readMe, updateMe } from '@directus/sdk';

import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import { directusClient } from '@/services/directus';

/**
 * Profile API
 *
 * The reader's own settings on their directus_users row. Best effort
 * throughout: a setting that does not reach the profile still holds on this
 * device, so nothing here throws, and nothing here may end a session.
 */

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

/** The profile's flourish color as stored, or null if it has none or cannot be read. */
export async function readProfileAkzent(): Promise<string | null> {
    try {
        if (!(await authorize())) return null;
        const me = await directusClient.request(readMe({ fields: ['akzent'] }));
        const value = (me as { akzent?: unknown }).akzent;
        return typeof value === 'string' ? value : null;
    } catch (err) {
        console.warn('Could not read the Akzent from the profile:', err);
        return null;
    }
}

export async function writeProfileAkzent(akzent: string): Promise<void> {
    try {
        if (!(await authorize())) return;
        // The client carries no schema, so the SDK knows only Directus' own
        // user fields; `akzent` is ours.
        const item = { akzent } as Parameters<typeof updateMe>[0];
        await directusClient.request(updateMe(item, { fields: ['id'] }));
    } catch (err) {
        console.warn('Could not save the Akzent to the profile:', err);
    }
}
