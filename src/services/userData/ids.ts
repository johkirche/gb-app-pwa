import { v5 } from 'uuid';

import type { ListKind } from '@/db';

/**
 * Ids that two devices arrive at on their own.
 *
 * Most rows get a random uuid. A few must not: the Favoriten list exists once
 * per account, a song is in it once, a verse carries one mark. If two devices
 * each made up their own id for those, the account would end up with two
 * Favoriten lists after the first offline afternoon. So their ids are derived
 * from what they are (RFC 4122 version 5), and the second device to upload one
 * finds the first one's row under the same key instead of adding a twin.
 */

// The app's namespace for those ids. Fixed for good: a new value would give
// every derived id a new value, and the server would see every list, entry
// and mark as one it has never had.
const NAMESPACE = '7fb3a7a4-fe32-466f-8c2e-c14bc7b8fc6b';

// A separator no part can contain, so ('a/b', 'c') and ('a', 'b/c') differ.
const SEPARATOR = '\u001f';

export function derivedId(...parts: string[]): string {
    return v5(parts.join(SEPARATOR), NAMESPACE);
}

/** The lists an account has exactly one of. */
export const SINGLETON_KINDS: readonly ListKind[] = ['favorites', 'bookmarks', 'saved'];

export function isSingletonKind(kind: ListKind): boolean {
    return SINGLETON_KINDS.includes(kind);
}

/**
 * The id of an account's Favoriten, Lesezeichen or Gespeichert list. Without an
 * account (a library read before signing in) the device stands in, and the
 * first sync folds that list into the account's own.
 */
export function singletonListId(ownerId: string | null, kind: ListKind): string {
    return derivedId('list', ownerId ?? 'device', kind);
}

/** An entry's id within its list: one row per song, passage or list it names. */
export function entryId(listId: string, itemKey: string): string {
    return derivedId('entry', listId, itemKey);
}

/**
 * The server's id for a mark. On the device a mark is keyed by its place in
 * the text (`bibel/joh/3/16`); the server keys every account's marks in one
 * table, so the account goes into the id there.
 */
export function markServerId(ownerId: string, markId: string): string {
    return derivedId('mark', ownerId, markId);
}
