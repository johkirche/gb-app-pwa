import { reactive, watch } from 'vue';

import { useUserStore } from '@/stores/user';

import {
    COLLECTIONS,
    type ServerEntry,
    type ServerList,
    type ServerMark,
    type ServerRows,
    type UserDataCollection,
    createRows,
    deleteRows,
    fetchOwnRows,
    isDuplicate,
    isGone,
    updateRow,
} from '@/api/userData.api';
import {
    type EntryKind,
    type ListKind,
    type ListStatus,
    type MarkColor,
    type ServiceType,
    type Synced,
    type TextMark,
    type UserList,
    type UserListEntry,
    db,
} from '@/db';
import { META_KEYS } from '@/db/metaKeys';
import { getDemoKey } from '@/services/demoAccess';
import { isNetworkError, isSessionEndedError } from '@/services/errorHandler';
import { resetRegisteredUserState } from '@/services/userStateReset';
import { listItemKeyOf, markId, refItemKey, songItemKeyOf } from '@/utils/textRef';

import { SINGLETON_KINDS, entryId, markServerId, singletonListId } from './ids';
import { reconcile } from './reconcile';
import { asSyncedTable, notifyApplied, onLocalUserDataChange } from './repo';
import { forgetSettingsState, pendingSettings, syncSettings } from './settingsSync';

/**
 * Keeping the reader's lists, entries, marks and settings on the account.
 *
 * The device is where everything is written first: the app never waits on the
 * server, and works the same offline. A sync then
 *   1. takes the account's rows from the server,
 *   2. settles them against the device's row by row (reconcile.ts), and
 *   3. uploads whatever the device changed and the server does not have yet.
 * It runs after a login, when the app is opened or comes back to the
 * foreground, when it goes online, and a moment after every change.
 *
 * Without a session nothing is lost: changes wait on the device, marked, and
 * go up after the next login — to the account they were made under only (see
 * claimUserData).
 */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'signedOut' | 'error';

export const userDataSync = reactive({
    status: 'idle' as SyncStatus,
    /** Changes on the device the account does not have yet. */
    pending: 0,
    lastSyncedAt: null as string | null,
    lastError: null as string | null,
});

/** Whose data the device holds. */
const OWNER_KEY = META_KEYS.userDataOwner;

const BATCH = 100;

// --- rows between server and device ------------------------------------------

function iso(value: string | null | undefined, fallback: string): string {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function settled(created: string, updated: string | null): Synced {
    const createdAt = iso(created, new Date(0).toISOString());
    return { dirty: 0, deleted: 0, synced: 1, createdAt, updatedAt: iso(updated, createdAt) };
}

export function listFromServer(s: ServerList): UserList {
    return {
        id: s.id,
        kind: s.kind as ListKind,
        status: (s.status ?? 'private') as ListStatus,
        name: s.name ?? null,
        emoji: s.emoji ?? null,
        gemeinde: s.gemeinde ?? null,
        serviceType: (s.service_type ?? null) as ServiceType | null,
        date: s.date ?? null,
        time: s.time ?? null,
        keep: !!s.keep,
        ...settled(s.date_created, s.date_updated),
    };
}

export function entryFromServer(s: ServerEntry): UserListEntry {
    return {
        id: s.id,
        listId: s.list,
        position: s.position ?? '',
        kind: s.kind as EntryKind,
        songId: s.song === null || s.song === undefined ? null : String(s.song),
        work: s.work ?? null,
        ref: s.ref ?? null,
        refEnd: s.ref_end ?? null,
        linkedListId: s.linked_list ?? null,
        verses: Array.isArray(s.verses) ? s.verses : null,
        note: s.note ?? null,
        official: !!s.official,
        ...settled(s.date_created, s.date_updated),
    };
}

export function markFromServer(s: ServerMark): TextMark {
    return {
        id: markId(s.work, s.ref),
        work: s.work,
        ref: s.ref,
        color: (s.color ?? null) as MarkColor | null,
        note: s.note ?? null,
        readAt: s.read_at ? iso(s.read_at, s.read_at) : null,
        ...settled(s.date_created, s.date_updated),
    };
}

function listPayload(l: UserList) {
    return {
        id: l.id,
        kind: l.kind,
        name: l.name,
        emoji: l.emoji,
        gemeinde: l.gemeinde,
        service_type: l.serviceType,
        date: l.date,
        time: l.time,
        keep: l.keep,
    };
}

function entryPayload(e: UserListEntry) {
    const song = e.songId === null ? null : Number(e.songId);
    return {
        id: e.id,
        list: e.listId,
        position: e.position,
        kind: e.kind,
        song: song !== null && Number.isInteger(song) ? song : null,
        work: e.work,
        ref: e.ref,
        ref_end: e.refEnd,
        linked_list: e.linkedListId,
        verses: e.verses,
        note: e.note,
    };
}

function markPayload(ownerId: string) {
    return (m: TextMark) => ({
        id: markServerId(ownerId, m.id),
        work: m.work,
        ref: m.ref,
        color: m.color,
        note: m.note,
        read_at: m.readAt,
    });
}

const sameList = (a: UserList, b: UserList) =>
    JSON.stringify(listPayload(a)) === JSON.stringify(listPayload(b)) && a.status === b.status;
const sameEntry = (a: UserListEntry, b: UserListEntry) =>
    JSON.stringify(entryPayload(a)) === JSON.stringify(entryPayload(b)) &&
    a.official === b.official;
const sameMark = (a: TextMark, b: TextMark) =>
    a.color === b.color && a.note === b.note && (a.readAt ?? null) === (b.readAt ?? null);

/** The key an entry is known by within its list (see ids.entryId). */
function itemKeyOf(e: UserListEntry): string {
    if (e.kind === 'song' && e.songId) return songItemKeyOf(e.songId);
    if (e.kind === 'list' && e.linkedListId) return listItemKeyOf(e.linkedListId);
    return refItemKey({ work: e.work ?? '', ref: e.ref ?? '', refEnd: e.refEnd });
}

// --- whose data -------------------------------------------------------------

/**
 * Make the device's lists the account's. The first account to sync takes over
 * what is on the device (everything kept before the sync existed). Another
 * account finds the device empty: what is there belongs to someone else, and
 * is dropped before it could be uploaded into the wrong account.
 */
export async function claimUserData(userId: string): Promise<void> {
    const owner = (await db.meta.get(OWNER_KEY))?.value;
    if (owner === userId) return;
    if (owner) {
        await db.transaction(
            'rw',
            [db.lists, db.listEntries, db.marks, db.leseplaene, db.meta],
            async () => {
                await Promise.all([
                    db.lists.clear(),
                    db.listEntries.clear(),
                    db.marks.clear(),
                    db.leseplaene.clear(),
                    db.meta.delete(META_KEYS.activeService),
                    db.meta.delete(META_KEYS.bibleLastRead),
                ]);
            },
        );
        await forgetSettingsState();
        await resetRegisteredUserState();
        await notifyApplied();
    }
    await db.meta.put({ key: OWNER_KEY, value: userId });
}

/** On logout: the device no longer holds anyone's data. */
export async function releaseUserData(): Promise<void> {
    await db.meta.delete(OWNER_KEY);
    await forgetSettingsState();
    userDataSync.pending = 0;
    userDataSync.lastSyncedAt = null;
}

// --- pull --------------------------------------------------------------------

/**
 * Lists the account has once (Favoriten, Lesezeichen, Gespeichert) that the
 * device made under another id — before the first login, or on a device that
 * raced another one to it — are folded into the account's: their entries move
 * over, the stray list goes.
 */
async function foldSingletons(server: ServerRows, ownerId: string): Promise<void> {
    for (const kind of SINGLETON_KINDS) {
        const onServer = server.lists
            .filter((l) => l.kind === kind)
            .sort((a, b) => a.date_created.localeCompare(b.date_created))[0];
        const canonical = onServer?.id ?? singletonListId(ownerId, kind);

        await db.transaction('rw', db.lists, db.listEntries, async () => {
            const strays = (await db.lists.where('kind').equals(kind).toArray()).filter(
                (l) => !l.deleted && l.id !== canonical,
            );
            if (strays.length === 0) return;
            const now = new Date().toISOString();

            if (!onServer && !(await db.lists.get(canonical))) {
                await db.lists.put({
                    ...strays[0],
                    id: canonical,
                    dirty: 1,
                    synced: 0,
                    updatedAt: now,
                });
            }
            for (const stray of strays) {
                const entries = await db.listEntries.where('listId').equals(stray.id).toArray();
                const moved = entries
                    .filter((e) => !e.deleted)
                    .map((e) => ({
                        ...e,
                        id: entryId(canonical, itemKeyOf(e)),
                        listId: canonical,
                        dirty: 1 as const,
                        synced: 0 as const,
                        updatedAt: now,
                    }));
                await db.listEntries.bulkDelete(entries.map((e) => e.id));
                await db.listEntries.bulkPut(moved);
                if (stray.synced) {
                    await db.lists.put({ ...stray, deleted: 1, dirty: 1, updatedAt: now });
                } else {
                    await db.lists.delete(stray.id);
                }
            }
        });
    }
}

/** Settle the server's rows against the device's. Returns whether anything changed here. */
async function applyServerRows(server: ServerRows): Promise<boolean> {
    let changed = false;
    await db.transaction('rw', db.lists, db.listEntries, db.marks, async () => {
        const lists = reconcile(await db.lists.toArray(), server.lists.map(listFromServer), {
            same: sameList,
            carry: (s, l) => ({ ...s, origin: l.origin ?? null }),
        });
        const entries = reconcile(
            await db.listEntries.toArray(),
            server.entries.map(entryFromServer),
            {
                same: sameEntry,
                carry: (s, l) => (l.snippet ? { ...s, snippet: l.snippet } : s),
            },
        );
        const marks = reconcile(await db.marks.toArray(), server.marks.map(markFromServer), {
            same: sameMark,
        });

        for (const [table, result] of [
            [db.lists, lists],
            [db.listEntries, entries],
            [db.marks, marks],
        ] as const) {
            const t = asSyncedTable(table);
            if (result.put.length) await t.bulkPut(result.put);
            if (result.remove.length) await t.bulkDelete(result.remove);
            changed ||= result.put.length > 0 || result.remove.length > 0;
        }
    });
    return changed;
}

// --- push --------------------------------------------------------------------

type SyncTable = typeof db.lists | typeof db.listEntries | typeof db.marks;
type Row = Synced & { id: string };

/** Rows the server took: settled, unless they were changed again meanwhile. */
async function settle(table: SyncTable, rows: Row[]): Promise<void> {
    await db.transaction('rw', table, async () => {
        const current = (await table.bulkGet(rows.map((r) => r.id))) as (Row | undefined)[];
        for (const [i, row] of rows.entries()) {
            const now = current[i];
            if (!now || now.updatedAt !== row.updatedAt) continue;
            if (now.deleted) await table.delete(row.id);
            else await table.put({ ...now, dirty: 0, synced: 1 } as never);
        }
    });
}

function fatal(error: unknown): boolean {
    return isSessionEndedError(error) || isNetworkError(error);
}

/**
 * Upload one table's changes: new rows in batches, then changed rows, then
 * deletions. A batch the server refuses is retried a row at a time, so one bad
 * row does not hold back the rest; that row stays marked for the next sync.
 */
async function pushTable(
    table: SyncTable,
    collection: UserDataCollection,
    payload: (row: never) => Record<string, unknown>,
    serverId: (row: Row) => string,
    phase: 'write' | 'delete',
): Promise<void> {
    const dirty = (await table.where('dirty').equals(1).toArray()) as Row[];

    const write = async (row: Row, asNew: boolean): Promise<void> => {
        try {
            if (asNew) await createRows(collection, [payload(row as never)]);
            else await updateRow(collection, serverId(row), payload(row as never));
        } catch (error) {
            if (fatal(error)) throw error;
            // Created meanwhile by another device, or gone from the server.
            if (asNew && isDuplicate(error)) return write(row, false);
            if (!asNew && isGone(error)) return write(row, true);
            throw error;
        }
    };

    const attempt = async (row: Row, run: () => Promise<void>) => {
        try {
            await run();
            await settle(table, [row]);
        } catch (error) {
            if (fatal(error)) throw error;
            console.warn(`Could not sync a row of ${collection}:`, error);
            userDataSync.lastError = `${collection}: ${String((error as Error)?.message ?? error)}`;
        }
    };

    if (phase === 'write') {
        const creates = dirty.filter((r) => !r.deleted && !r.synced);
        for (let i = 0; i < creates.length; i += BATCH) {
            const chunk = creates.slice(i, i + BATCH);
            try {
                await createRows(
                    collection,
                    chunk.map((r) => payload(r as never)),
                );
                await settle(table, chunk);
            } catch (error) {
                if (fatal(error)) throw error;
                for (const row of chunk) await attempt(row, () => write(row, true));
            }
        }
        for (const row of dirty.filter((r) => !r.deleted && r.synced)) {
            await attempt(row, () => write(row, false));
        }
        return;
    }

    const deletes = dirty.filter((r) => r.deleted);
    for (let i = 0; i < deletes.length; i += BATCH) {
        const chunk = deletes.slice(i, i + BATCH);
        try {
            await deleteRows(collection, chunk.map(serverId));
            await settle(table, chunk);
        } catch (error) {
            if (fatal(error)) throw error;
            for (const row of chunk) {
                await attempt(row, async () => {
                    try {
                        await deleteRows(collection, [serverId(row)]);
                    } catch (e) {
                        if (!isGone(e)) throw e;
                    }
                });
            }
        }
    }
}

async function pushAll(ownerId: string): Promise<void> {
    const own = (row: Row) => row.id;
    const mark = (row: Row) => markServerId(ownerId, row.id);
    // Lists before their entries, entries before the lists they are deleted with.
    await pushTable(db.lists, COLLECTIONS.lists, listPayload as never, own, 'write');
    await pushTable(db.listEntries, COLLECTIONS.entries, entryPayload as never, own, 'write');
    await pushTable(db.marks, COLLECTIONS.marks, markPayload(ownerId) as never, mark, 'write');
    await pushTable(db.listEntries, COLLECTIONS.entries, entryPayload as never, own, 'delete');
    await pushTable(db.marks, COLLECTIONS.marks, markPayload(ownerId) as never, mark, 'delete');
    await pushTable(db.lists, COLLECTIONS.lists, listPayload as never, own, 'delete');
}

// --- the run -----------------------------------------------------------------

export async function countPending(): Promise<number> {
    const [lists, entries, marks, settings] = await Promise.all([
        db.lists.where('dirty').equals(1).count(),
        db.listEntries.where('dirty').equals(1).count(),
        db.marks.where('dirty').equals(1).count(),
        pendingSettings(),
    ]);
    return lists + entries + marks + settings;
}

async function refreshPending(): Promise<void> {
    try {
        userDataSync.pending = await countPending();
    } catch {
        // the count is a hint; a failed read leaves the last one
    }
}

async function runOnce(): Promise<void> {
    const userStore = useUserStore();
    await userStore.initPromise;
    const user = userStore.user;

    if (!userStore.isLoggedIn || !user || userStore.devSkipAuth) {
        userDataSync.status = 'signedOut';
        return;
    }
    // A demo library has no account to keep anything on.
    if (getDemoKey()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        userDataSync.status = 'offline';
        return;
    }

    userDataSync.status = 'syncing';
    try {
        await claimUserData(user.id);
        const server = await fetchOwnRows();
        await foldSingletons(server, user.id);
        let applied = await applyServerRows(server);
        await pushAll(user.id);
        applied = (await syncSettings()) || applied;
        userDataSync.status = 'idle';
        userDataSync.lastSyncedAt = new Date().toISOString();
        if (applied) await notifyApplied();
    } catch (error) {
        if (isSessionEndedError(error)) {
            userDataSync.status = 'signedOut';
        } else if (isNetworkError(error)) {
            userDataSync.status = 'offline';
        } else {
            console.error('Error syncing the user data:', error);
            userDataSync.status = 'error';
            userDataSync.lastError = String((error as Error)?.message ?? error);
        }
    }
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Sync now. Calls while one is running wait for it, and it runs once more at
 * the end, so a change made during a sync is never left behind.
 */
export function syncUserData(): Promise<void> {
    if (running) {
        again = true;
        return running;
    }
    running = (async () => {
        try {
            do {
                again = false;
                await runOnce();
            } while (again);
        } finally {
            running = null;
            await refreshPending();
        }
    })();
    return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Sync a moment from now: a run of quick changes goes up together. */
export function scheduleSync(delayMs = 1500): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        timer = null;
        void syncUserData();
    }, delayMs);
}

let started = false;
let lastRun = 0;

/** Wire the sync to the app's life. Called once, from the shell. */
export function startUserDataSync(): void {
    if (started) return;
    started = true;

    onLocalUserDataChange(() => {
        void refreshPending();
        scheduleSync();
    });

    const soon = () => {
        // Coming back to the app every few seconds should not mean a request
        // each time; a minute is fresh enough for lists.
        if (Date.now() - lastRun < 60_000) return;
        lastRun = Date.now();
        void syncUserData();
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => void syncUserData());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') soon();
        });
    }

    // A login (or a session taken up again) syncs at once: the reader expects
    // their lists the moment they are in.
    const userStore = useUserStore();
    watch(
        () => (userStore.isLoggedIn ? userStore.user?.id : null),
        (id, previous) => {
            if (id && id !== previous) {
                lastRun = Date.now();
                void syncUserData();
            } else if (!id) {
                userDataSync.status = 'signedOut';
                void refreshPending();
            }
        },
    );

    lastRun = Date.now();
    void syncUserData();
}
