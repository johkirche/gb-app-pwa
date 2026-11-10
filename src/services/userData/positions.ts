import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Where an entry stands in its list, as a key that sorts as a plain string.
 *
 * A list's order is not a number per entry but a key between its neighbours
 * (fractional indexing): moving an entry rewrites that entry and nothing else,
 * so two devices reordering different parts of a list do not overwrite each
 * other's work, and an entry added on one device lands where it was put.
 */

/** Plain code-unit comparison — the order the keys are made for. Never localeCompare. */
export function comparePositions(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

export function byPosition<T extends { position: string; id: string }>(a: T, b: T): number {
    return comparePositions(a.position, b.position) || comparePositions(a.id, b.id);
}

/** A key after `last`, or the first key for an empty list. */
export function positionAfter(last: string | null | undefined): string {
    return generateKeyBetween(last ?? null, null);
}

/**
 * Positions for `ids` in that order, changing as few existing ones as can be.
 *
 * The entries that already have a position keep the set of positions they hold
 * between them, handed out again in the new order — a reorder writes only the
 * entries that moved. An id without a position gets a fresh key between its
 * neighbours, so an append writes only itself.
 */
export function assignPositions(
    ids: readonly string[],
    existing: ReadonlyMap<string, string>,
): Map<string, string> {
    const held = ids
        .map((id) => existing.get(id))
        .filter((p): p is string => p !== undefined)
        .sort(comparePositions);

    // Two devices appending offline after the same entry both pick the same
    // key. There is no key between two equal ones, so such a list is numbered
    // afresh: every entry is written once, and the list is whole again.
    if (held.some((p, i) => i > 0 && p === held[i - 1])) {
        const fresh = generateNKeysBetween(null, null, ids.length);
        return new Map(ids.map((id, i) => [id, fresh[i]]));
    }

    // The positions the existing entries take, in the new order.
    const result = new Map<string, string>();
    let next = 0;
    for (const id of ids) {
        if (existing.has(id)) result.set(id, held[next++]);
    }

    // The new ones go between whatever came before and after them.
    for (let i = 0; i < ids.length; i++) {
        if (result.has(ids[i])) continue;
        const before = i > 0 ? (result.get(ids[i - 1]) ?? null) : null;
        let after: string | null = null;
        for (let j = i + 1; j < ids.length; j++) {
            const p = result.get(ids[j]);
            if (p !== undefined) {
                after = p;
                break;
            }
        }
        result.set(ids[i], generateKeyBetween(before, after));
    }
    return result;
}
