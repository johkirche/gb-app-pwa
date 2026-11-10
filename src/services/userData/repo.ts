import type { Table } from 'dexie';

import {
    type EntryKind,
    type ListKind,
    type Synced,
    type TextMark,
    type UserList,
    type UserListEntry,
    db,
} from '@/db';

import { byPosition } from './positions';

/**
 * The reader's lists, entries and marks on this device.
 *
 * Every write goes through here so it is stamped for the sync the same way:
 * changed now, waiting to be uploaded. A deletion of a row the server already
 * has leaves a tombstone, so the sync can delete it there too; a row the server
 * never had just goes. Reads leave the tombstones out.
 *
 * The stores read through here as well, and register to be told when the sync
 * has brought in something from another device (onUserDataApplied).
 */

/** A row as a store hands it in: everything but the sync's bookkeeping. */
export type Fresh<T extends Synced> = Omit<T, keyof Synced> & { createdAt?: string };

type Listener = () => unknown;

const localChange = new Set<Listener>();
const applied = new Set<Listener>();

/** Called after every local write: the sync schedules an upload from it. */
export function onLocalUserDataChange(listener: Listener): () => void {
    localChange.add(listener);
    return () => localChange.delete(listener);
}

/** Called after the sync wrote rows from the server: stores reload from it. */
export function onUserDataApplied(listener: Listener): () => void {
    applied.add(listener);
    return () => applied.delete(listener);
}

function emit(listeners: Set<Listener>) {
    for (const listener of listeners) {
        try {
            void listener();
        } catch (err) {
            console.error('Error in a user data listener:', err);
        }
    }
}

export function notifyLocalChange(): void {
    emit(localChange);
}

export async function notifyApplied(): Promise<void> {
    for (const listener of applied) {
        try {
            await listener();
        } catch (err) {
            console.error('Error reloading after a sync:', err);
        }
    }
}

function stamp<T extends Synced>(row: Fresh<T>, previous: Synced | undefined, now: string): T {
    return {
        ...row,
        createdAt: previous?.createdAt ?? row.createdAt ?? now,
        updatedAt: now,
        dirty: 1,
        deleted: 0,
        synced: previous?.synced ?? 0,
    } as unknown as T;
}

/**
 * A copy IndexedDB can store. A row read back out of a store is a reactive
 * proxy, and its arrays are too (DataCloneError); JSON is enough for these
 * rows, which hold strings, numbers, booleans and arrays of them.
 */
function plain<T>(row: T): T {
    return JSON.parse(JSON.stringify(row)) as T;
}

/** One of the three tables, as the code that treats them alike sees it. */
export type SyncedTable = Table<Synced & { id: string }, string>;

export function asSyncedTable(table: typeof db.lists | typeof db.listEntries | typeof db.marks) {
    return table as unknown as SyncedTable;
}

/** Write rows, stamped as changed. Unchanged fields of an existing row are kept by the caller. */
async function put<T extends Synced & { id: string }>(
    dexieTable: typeof db.lists | typeof db.listEntries | typeof db.marks,
    rows: Fresh<T>[],
): Promise<void> {
    const table = asSyncedTable(dexieTable);
    if (rows.length === 0) return;
    const now = new Date().toISOString();
    await db.transaction('rw', dexieTable, async () => {
        const ids = rows.map((r) => (r as unknown as { id: string }).id);
        const previous = (await table.bulkGet(ids)) as (T | undefined)[];
        await table.bulkPut(rows.map((row, i) => plain(stamp<T>(row, previous[i], now))) as never);
    });
    notifyLocalChange();
}

export const putLists = (rows: Fresh<UserList>[]) => put<UserList>(db.lists, rows);
export const putEntries = (rows: Fresh<UserListEntry>[]) =>
    put<UserListEntry>(db.listEntries, rows);
export const putMarks = (rows: Fresh<TextMark>[]) => put<TextMark>(db.marks, rows);

/** Tombstone what the server has, drop what it never had. */
async function remove(
    dexieTable: typeof db.lists | typeof db.listEntries | typeof db.marks,
    ids: string[],
): Promise<void> {
    const table = asSyncedTable(dexieTable);
    const now = new Date().toISOString();
    const rows = (await table.bulkGet(ids)).filter((r): r is NonNullable<typeof r> => !!r);
    const tombstones = rows
        .filter((r) => r.synced)
        .map((r) => ({ ...r, deleted: 1 as const, dirty: 1 as const, updatedAt: now }));
    const gone = rows.filter((r) => !r.synced).map((r) => r.id);
    if (tombstones.length) await table.bulkPut(tombstones as never);
    if (gone.length) await table.bulkDelete(gone);
}

/**
 * Delete lists. Their entries go from the device at once and are not uploaded
 * as deletions: the server deletes a list's entries with it.
 */
export async function deleteLists(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.transaction('rw', db.lists, db.listEntries, async () => {
        await remove(db.lists, ids);
        await db.listEntries.where('listId').anyOf(ids).delete();
    });
    notifyLocalChange();
}

export async function deleteEntries(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.transaction('rw', db.listEntries, () => remove(db.listEntries, ids));
    notifyLocalChange();
}

/**
 * Change marks in one go. `change` gets each mark as it stands (or undefined)
 * and returns what it should become, or null for nothing left on that place.
 * Read inside the transaction, so a colour set here never overwrites a note
 * written elsewhere a moment ago.
 */
export async function updateMarks(
    ids: string[],
    change: (current: TextMark | undefined, id: string) => Fresh<TextMark> | null,
): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    await db.transaction('rw', db.marks, async () => {
        const current = await db.marks.bulkGet(ids);
        const puts: TextMark[] = [];
        const removals: string[] = [];
        ids.forEach((id, i) => {
            const live = current[i] && !current[i]!.deleted ? current[i] : undefined;
            const next = change(live, id);
            if (next === null) {
                if (current[i]) removals.push(id);
            } else {
                puts.push(plain(stamp<TextMark>(next, current[i], now)));
            }
        });
        if (puts.length) await db.marks.bulkPut(puts);
        if (removals.length) await remove(db.marks, removals);
    });
    notifyLocalChange();
}

// --- reads ------------------------------------------------------------------

export async function listsOfKind(kind: ListKind): Promise<UserList[]> {
    return (await db.lists.where('kind').equals(kind).toArray()).filter((l) => !l.deleted);
}

export async function getList(id: string): Promise<UserList | undefined> {
    const row = await db.lists.get(id);
    return row && !row.deleted ? row : undefined;
}

/** A list's entries in their order. */
export async function entriesOf(listId: string): Promise<UserListEntry[]> {
    const rows = await db.listEntries.where('listId').equals(listId).toArray();
    return rows.filter((e) => !e.deleted).sort(byPosition);
}

/** The entries of several lists, each list's in order. */
export async function entriesOfLists(listIds: string[]): Promise<Map<string, UserListEntry[]>> {
    const rows = await db.listEntries.where('listId').anyOf(listIds).toArray();
    const result = new Map<string, UserListEntry[]>(listIds.map((id) => [id, []]));
    for (const row of rows.filter((e) => !e.deleted).sort(byPosition)) {
        result.get(row.listId)?.push(row);
    }
    return result;
}

export async function liveMarks(work?: string): Promise<TextMark[]> {
    const rows = work
        ? await db.marks.where('work').equals(work).toArray()
        : await db.marks.toArray();
    return rows.filter((m) => !m.deleted);
}

// --- helpers for building rows -----------------------------------------------

export function newList(
    fields: Partial<Fresh<UserList>> & Pick<UserList, 'id' | 'kind'>,
): Fresh<UserList> {
    return {
        status: 'private',
        name: null,
        emoji: null,
        gemeinde: null,
        serviceType: null,
        date: null,
        time: null,
        keep: false,
        ...fields,
    };
}

export function newEntry(
    fields: Partial<Fresh<UserListEntry>> &
        Pick<UserListEntry, 'id' | 'listId' | 'kind' | 'position'> & { kind: EntryKind },
): Fresh<UserListEntry> {
    return {
        songId: null,
        work: null,
        ref: null,
        refEnd: null,
        linkedListId: null,
        verses: null,
        note: null,
        official: false,
        ...fields,
    };
}

/** A stored row as a store hands it back in for a change: without the sync's fields. */
export function fresh<T extends Synced>(row: T): Fresh<T> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dirty, deleted, synced, updatedAt, ...rest } = row;
    return rest as Fresh<T>;
}
