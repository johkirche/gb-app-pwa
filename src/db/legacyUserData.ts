import { generateNKeysBetween } from 'fractional-indexing';

import type {
    BibelPassage,
    Favorite,
    GelesenesKapitel,
    Lesezeichen,
    MarkColor,
    Markierung,
    MarkierungsFarbe,
    Notiz,
    Playlist,
    ServicePlan,
    Synced,
    TextMark,
    UserList,
    UserListEntry,
} from '@/db';
import { entryId, singletonListId } from '@/services/userData/ids';
import {
    type TextRef,
    chapterMarkId,
    passageToRef,
    refItemKey,
    songItemKeyOf,
    verseMarkId,
} from '@/utils/textRef';

/**
 * The reader's data as the tables before version 11 held it, turned into the
 * rows of lists, entries and marks (see the version 11 upgrade in db/index.ts).
 *
 * Every row comes out changed and never synced, so the first sync after the
 * update uploads all of it. Nothing here looks anything up: an upgrade runs in
 * one IndexedDB transaction, and that must not wait on anything else.
 */

export interface LegacyUserData {
    playlists: Playlist[];
    favorites: Favorite[];
    lesezeichen: Lesezeichen[];
    services: ServicePlan[];
    markierungen: Markierung[];
    notizen: Notiz[];
    gelesen: GelesenesKapitel[];
}

export interface UserDataRows {
    lists: UserList[];
    entries: UserListEntry[];
    marks: TextMark[];
}

export const MARK_COLORS: Record<MarkierungsFarbe, MarkColor> = {
    gelb: 'yellow',
    gruen: 'green',
    blau: 'blue',
    rosa: 'pink',
};

/** An ISO string from whatever a stored date became (a Date, or a string from an import). */
function iso(value: unknown, fallback: string): string {
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function unsynced(createdAt: string, updatedAt: string = createdAt): Synced {
    return { dirty: 1, deleted: 0, synced: 0, createdAt, updatedAt };
}

function list(fields: Partial<UserList> & Pick<UserList, 'id' | 'kind'>, sync: Synced): UserList {
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
        ...sync,
    };
}

type EntryFields = Partial<UserListEntry> &
    Pick<UserListEntry, 'listId' | 'kind' | 'position'> & { itemKey: string };

function entry({ itemKey, ...fields }: EntryFields, sync: Synced): UserListEntry {
    return {
        id: entryId(fields.listId, itemKey),
        songId: null,
        work: null,
        ref: null,
        refEnd: null,
        linkedListId: null,
        verses: null,
        note: null,
        official: false,
        ...fields,
        ...sync,
    };
}

function passageEntry(listId: string, passage: BibelPassage, position: string, sync: Synced) {
    const ref: TextRef = passageToRef(passage);
    return entry({ listId, kind: 'passage', position, itemKey: refItemKey(ref), ...ref }, sync);
}

function passageKeyOf(p: BibelPassage): string {
    return [p.slug, p.chapter, p.verse ?? '', p.endVerse ?? ''].join('/');
}

export function convertLegacyUserData(
    legacy: LegacyUserData,
    ownerId: string | null,
    now: string,
): UserDataRows {
    const lists: UserList[] = [];
    const entries: UserListEntry[] = [];

    // Playlists: the songs in their order, then the passages in theirs. The
    // two were never interleaved, so the passages simply follow the songs.
    for (const playlist of legacy.playlists) {
        const created = iso(playlist.createdAt, now);
        const sync = unsynced(created, iso(playlist.updatedAt, created));
        lists.push(
            list(
                { id: playlist.id, kind: 'collection', name: playlist.name, emoji: playlist.emoji },
                sync,
            ),
        );
        const songIds = [...new Set(playlist.songIds ?? [])];
        const passagen = playlist.passagen ?? [];
        const positions = generateNKeysBetween(null, null, songIds.length + passagen.length);
        songIds.forEach((songId, i) =>
            entries.push(
                entry(
                    {
                        listId: playlist.id,
                        kind: 'song',
                        position: positions[i],
                        itemKey: songItemKeyOf(songId),
                        songId,
                    },
                    sync,
                ),
            ),
        );
        passagen.forEach((passage, i) =>
            entries.push(passageEntry(playlist.id, passage, positions[songIds.length + i], sync)),
        );
    }

    // Favoriten and Lesezeichen: one list each, oldest first.
    const byCreated = <T extends { createdAt: Date }>(rows: T[]) =>
        [...rows].sort((a, b) => iso(a.createdAt, now).localeCompare(iso(b.createdAt, now)));

    if (legacy.favorites.length > 0) {
        const listId = singletonListId(ownerId, 'favorites');
        const favorites = byCreated(legacy.favorites);
        const first = iso(favorites[0].createdAt, now);
        lists.push(list({ id: listId, kind: 'favorites' }, unsynced(first)));
        const positions = generateNKeysBetween(null, null, favorites.length);
        favorites.forEach((favorite, i) =>
            entries.push(
                entry(
                    {
                        listId,
                        kind: 'song',
                        position: positions[i],
                        itemKey: songItemKeyOf(favorite.id),
                        songId: favorite.id,
                    },
                    unsynced(iso(favorite.createdAt, now)),
                ),
            ),
        );
    }

    if (legacy.lesezeichen.length > 0) {
        const listId = singletonListId(ownerId, 'bookmarks');
        const marks = byCreated(legacy.lesezeichen);
        lists.push(list({ id: listId, kind: 'bookmarks' }, unsynced(iso(marks[0].createdAt, now))));
        const positions = generateNKeysBetween(null, null, marks.length);
        marks.forEach((mark, i) => {
            const row = passageEntry(
                listId,
                { slug: mark.slug, chapter: mark.chapter, verse: mark.verse },
                positions[i],
                unsynced(iso(mark.createdAt, now)),
            );
            entries.push(mark.snippet ? { ...row, snippet: mark.snippet } : row);
        });
    }

    // The Gottesdienst selection: songs and readings in the one order the
    // page showed them — `order` where the plan was ever reordered, songs
    // first and readings after them where it was not.
    for (const plan of legacy.services) {
        const created = iso(plan.createdAt, now);
        const sync = unsynced(created, iso(plan.updatedAt, created));
        lists.push(
            list(
                {
                    id: plan.id,
                    kind: 'service',
                    name: plan.title,
                    date: plan.date,
                    origin: plan.origin ?? null,
                },
                sync,
            ),
        );
        type Item = { key: string; make: (position: string) => UserListEntry };
        const items: Item[] = [
            ...(plan.entries ?? []).map(
                (e): Item => ({
                    key: `song:${e.songId}`,
                    make: (position) =>
                        entry(
                            {
                                listId: plan.id,
                                kind: 'song',
                                position,
                                itemKey: songItemKeyOf(e.songId),
                                songId: e.songId,
                                verses: e.verses ? [...e.verses] : null,
                                note: e.note ?? null,
                            },
                            sync,
                        ),
                }),
            ),
            ...(plan.lesungen ?? []).map(
                (p): Item => ({
                    key: `lesung:${passageKeyOf(p)}`,
                    make: (position) => passageEntry(plan.id, p, position, sync),
                }),
            ),
        ];
        const byKey = new Map(items.map((item) => [item.key, item]));
        const ordered = [...new Set(plan.order ?? [])]
            .map((key) => byKey.get(key))
            .filter((item): item is Item => item !== undefined);
        const placed = new Set(ordered.map((item) => item.key));
        const all = [...ordered, ...items.filter((item) => !placed.has(item.key))];
        const positions = generateNKeysBetween(null, null, all.length);
        all.forEach((item, i) => entries.push(item.make(positions[i])));
    }

    // Marks: a verse's colour and its note in one row, a chapter read in another.
    const marks = new Map<string, TextMark>();
    const mark = (id: string, ref: string, at: string): TextMark => {
        const existing = marks.get(id);
        if (existing) return existing;
        const row: TextMark = {
            id,
            work: 'bibel',
            ref,
            color: null,
            note: null,
            readAt: null,
            ...unsynced(at),
        };
        marks.set(id, row);
        return row;
    };
    for (const m of legacy.markierungen) {
        const at = iso(m.createdAt, now);
        const row = mark(
            verseMarkId(m.slug, m.chapter, m.verse),
            `${m.slug}/${m.chapter}/${m.verse}`,
            at,
        );
        row.color = MARK_COLORS[m.color] ?? null;
    }
    for (const n of legacy.notizen) {
        const at = iso(n.updatedAt, now);
        const row = mark(
            verseMarkId(n.slug, n.chapter, n.verse),
            `${n.slug}/${n.chapter}/${n.verse}`,
            at,
        );
        row.note = n.text;
        if (at > row.updatedAt) row.updatedAt = at;
    }
    for (const g of legacy.gelesen) {
        const at = iso(g.readAt, now);
        const row = mark(chapterMarkId(g.slug, g.chapter), `${g.slug}/${g.chapter}`, at);
        row.readAt = at;
    }

    return { lists, entries, marks: [...marks.values()] };
}
