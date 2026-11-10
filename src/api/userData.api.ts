import { createItems, deleteItems, readItems, updateItem } from '@directus/sdk';

import { useUserStore } from '@/stores/user';

import { refreshAuthToken } from '@/composables/useAuth';

import { directusClient } from '@/services/directus';
import { SESSION_ENDED_ERROR, extractDirectusErrorCode } from '@/services/errorHandler';

/**
 * User data API
 *
 * The reader's lists, entries and marks on the account: the Directus
 * collections app_liste, app_liste_eintrag and app_markierung (set up by
 * gb-scripts/app/37-setup-nutzerdaten.py). Read and written only by the sync
 * (services/userData/sync.ts), which owns what these rows mean.
 *
 * The policies let an account read and write its own rows and nothing else,
 * and the server stamps who wrote a row, so nothing here sends user_created.
 */

export const COLLECTIONS = {
    lists: 'app_liste',
    entries: 'app_liste_eintrag',
    marks: 'app_markierung',
} as const;

export type UserDataCollection = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export interface ServerList {
    id: string;
    kind: string;
    status: string;
    name: string | null;
    emoji: string | null;
    gemeinde: string | null;
    service_type: string | null;
    date: string | null;
    time: string | null;
    keep: boolean;
    date_created: string;
    date_updated: string | null;
}

export interface ServerEntry {
    id: string;
    list: string;
    position: string | null;
    kind: string;
    song: number | string | null;
    work: string | null;
    ref: string | null;
    ref_end: string | null;
    linked_list: string | null;
    verses: number[] | null;
    note: string | null;
    official: boolean;
    date_created: string;
    date_updated: string | null;
}

export interface ServerMark {
    id: string;
    work: string;
    ref: string;
    color: string | null;
    note: string | null;
    read_at: string | null;
    date_created: string;
    date_updated: string | null;
}

export interface ServerRows {
    lists: ServerList[];
    entries: ServerEntry[];
    marks: ServerMark[];
}

const FIELDS = {
    lists: [
        'id',
        'kind',
        'status',
        'name',
        'emoji',
        'gemeinde',
        'service_type',
        'date',
        'time',
        'keep',
        'date_created',
        'date_updated',
    ],
    entries: [
        'id',
        'list',
        'position',
        'kind',
        'song',
        'work',
        'ref',
        'ref_end',
        'linked_list',
        'verses',
        'note',
        'official',
        'date_created',
        'date_updated',
    ],
    marks: ['id', 'work', 'ref', 'color', 'note', 'read_at', 'date_created', 'date_updated'],
};

/** Only the account's own rows: the published Abläufe of its Gemeinde are readable too, and are not its to sync. */
const OWN = { user_created: { _eq: '$CURRENT_USER' } };

function status(error: unknown): number | undefined {
    return (error as { response?: { status?: number } } | null)?.response?.status;
}

/**
 * Run a request with the session's token, renewing it once if the server says
 * it has run out. A session that cannot be renewed throws SESSION_ENDED_ERROR;
 * anything else (offline, a server error) is thrown as it came.
 */
async function withSession<T>(request: () => Promise<T>): Promise<T> {
    const userStore = useUserStore();
    const ended = () => new Error(SESSION_ENDED_ERROR);

    if (!userStore.isLoggedIn) throw ended();
    if (userStore.isTokenExpired() && !(await refreshAuthToken()) && !userStore.authData) {
        throw ended();
    }
    const token = userStore.authData?.accessToken;
    if (!token) throw ended();
    await directusClient.setToken(token);

    try {
        return await request();
    } catch (error) {
        if (status(error) !== 401) throw error;
        // An access token the server no longer takes (TOKEN_EXPIRED, or one
        // renewed by another tab): renew and ask once more. Only a refresh the
        // server turns down ends the session, and refreshAuthToken sees to that.
        if (await refreshAuthToken()) {
            await directusClient.setToken(userStore.authData!.accessToken);
            return await request();
        }
        if (!userStore.authData) throw new Error(SESSION_ENDED_ERROR, { cause: error });
        throw error;
    }
}

export function errorCode(error: unknown): string | undefined {
    return extractDirectusErrorCode(error);
}

/** The server no longer has the row, or never had it: Directus answers both with 403. */
export function isGone(error: unknown): boolean {
    return status(error) === 403 || status(error) === 404 || errorCode(error) === 'FORBIDDEN';
}

export function isDuplicate(error: unknown): boolean {
    return errorCode(error) === 'RECORD_NOT_UNIQUE';
}

/** Everything the account keeps, in three requests. */
export async function fetchOwnRows(): Promise<ServerRows> {
    const read = <T>(collection: UserDataCollection, fields: string[]) =>
        withSession(
            () =>
                directusClient.request(
                    readItems(collection as never, { fields, filter: OWN, limit: -1 } as never),
                ) as Promise<T[]>,
        );
    const [lists, entries, marks] = await Promise.all([
        read<ServerList>(COLLECTIONS.lists, FIELDS.lists),
        read<ServerEntry>(COLLECTIONS.entries, FIELDS.entries),
        read<ServerMark>(COLLECTIONS.marks, FIELDS.marks),
    ]);
    return { lists, entries, marks };
}

export async function createRows(
    collection: UserDataCollection,
    rows: Record<string, unknown>[],
): Promise<void> {
    if (rows.length === 0) return;
    await withSession(() =>
        directusClient.request(
            createItems(collection as never, rows as never, { fields: ['id'] } as never),
        ),
    );
}

export async function updateRow(
    collection: UserDataCollection,
    id: string,
    data: Record<string, unknown>,
): Promise<void> {
    await withSession(() =>
        directusClient.request(
            updateItem(collection as never, id, data as never, { fields: ['id'] } as never),
        ),
    );
}

export async function deleteRows(collection: UserDataCollection, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await withSession(() => directusClient.request(deleteItems(collection as never, ids)));
}
