import type { Synced } from '@/db';

/**
 * What the server's rows mean for the device's, decided row by row.
 *
 * Pure, so the rules can be read and tested in one place:
 *
 * - A row only the server has is new from another device: take it.
 * - A row both have, unchanged here: take the server's, which is the newer.
 * - A row both have, changed here and not yet uploaded: the later change wins
 *   (the device's `updatedAt` against the server's `date_updated`). Equal
 *   content counts as settled either way.
 * - A row only the device has: new here if the server never had it (upload
 *   it); deleted on another device if it had (drop it) — unless it was changed
 *   here since, in which case the change is kept and uploaded afresh.
 */

export interface Reconciled<T> {
    /** Rows to write on the device, as they should stand. */
    put: T[];
    /** Rows to drop from the device. */
    remove: string[];
}

export function reconcile<T extends Synced & { id: string }>(
    local: readonly T[],
    server: readonly T[],
    options: {
        /** Whether two rows say the same, the sync's bookkeeping aside. */
        same: (a: T, b: T) => boolean;
        /** Carry the device-only fields of `local` onto a row from the server. */
        carry?: (fromServer: T, local: T) => T;
    },
): Reconciled<T> {
    const carry = options.carry ?? ((s: T) => s);
    const localById = new Map(local.map((row) => [row.id, row]));
    const onServer = new Set(server.map((row) => row.id));
    const put: T[] = [];
    const remove: string[] = [];

    for (const s of server) {
        const l = localById.get(s.id);
        if (!l) {
            put.push(s);
            continue;
        }
        if (!l.dirty) {
            if (!l.synced || l.updatedAt !== s.updatedAt || !options.same(l, s))
                put.push(carry(s, l));
            continue;
        }
        if (!l.deleted && options.same(l, s)) {
            put.push(carry(s, l));
        } else if (s.updatedAt > l.updatedAt) {
            put.push(carry(s, l));
        } else if (!l.synced) {
            // Another device uploaded the same derived id first; ours is the
            // later change, so it goes up as an update.
            put.push({ ...l, synced: 1 });
        }
    }

    for (const l of local) {
        if (onServer.has(l.id) || !l.synced) continue;
        if (!l.dirty || l.deleted) remove.push(l.id);
        else put.push({ ...l, synced: 0 });
    }

    return { put, remove };
}
