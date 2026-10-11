import type { Lesezeichen, Markierung, MarkierungsFarbe, Notiz } from '@/db';
import { BIBEL_BOOKS, type BibelBook } from '@/utils/bibel';
import { versesRefLabel } from '@/utils/bibelVerses';

/**
 * „Meine Stellen": every verse the reader has kept — with a Lesezeichen, a
 * colour or a note — as one list. The Bibel tab shows its first few rows; the
 * page of its own finds, sorts and clears them once there are many.
 */

/**
 * How many rows the Bibel tab shows of each list. Few enough that the books
 * stay near the top of a phone; the rest are on Meine Stellen.
 */
export const STELLEN_PREVIEW = 3;

/** The highlight colours as the reader is offered them, in that order. */
export const MARKIERUNGS_FARBEN: { key: MarkierungsFarbe; label: string }[] = [
    { key: 'gelb', label: 'Gelb' },
    { key: 'gruen', label: 'Grün' },
    { key: 'blau', label: 'Blau' },
    { key: 'rosa', label: 'Rosa' },
];

export type StellenArt = 'alle' | 'lesezeichen' | 'notizen' | 'markierungen';
export type StellenOrdnung = 'buch' | 'neueste';

/**
 * One row: a verse, or a run of verses highlighted together in one colour —
 * Matthäus 5,3-9 marked as a passage is one thing to the reader, not seven.
 */
export interface Stelle {
    /** The first verse's `slug/chapter/verse`, which keys the row. */
    id: string;
    slug: string;
    chapter: number;
    /** In order; more than one only for a highlighted run. */
    verses: number[];
    /** The Lesezeichen's snippet, when the verse carries one. */
    lesezeichen?: string;
    color?: MarkierungsFarbe;
    note?: string;
    /** When the reader last did something to it. */
    at: Date;
}

/** Where a book stands in the canon, for sorting rows into the Bible's order. */
const BOOK_INDEX = new Map(BIBEL_BOOKS.map((book, i) => [book.slug, i]));

function position(a: Stelle, b: Stelle): number {
    return (
        (BOOK_INDEX.get(a.slug) ?? Infinity) - (BOOK_INDEX.get(b.slug) ?? Infinity) ||
        a.chapter - b.chapter ||
        a.verses[0] - b.verses[0]
    );
}

function later(a: Date, b: Date | string): Date {
    const date = new Date(b);
    return date.getTime() > a.getTime() ? date : a;
}

/** Every kept verse, one row each, newest first. */
export function stellen(
    lesezeichen: Lesezeichen[],
    markierungen: Markierung[],
    notizen: Notiz[],
): Stelle[] {
    const rows = new Map<string, Stelle>();
    const row = (from: { id: string; slug: string; chapter: number; verse: number }) => {
        let found = rows.get(from.id);
        if (!found) {
            found = {
                id: from.id,
                slug: from.slug,
                chapter: from.chapter,
                verses: [from.verse],
                at: new Date(0),
            };
            rows.set(from.id, found);
        }
        return found;
    };
    for (const l of lesezeichen) {
        const r = row(l);
        r.lesezeichen = l.snippet;
        r.at = later(r.at, l.createdAt);
    }
    for (const m of markierungen) {
        const r = row(m);
        r.color = m.color;
        r.at = later(r.at, m.createdAt);
    }
    for (const n of notizen) {
        const r = row(n);
        r.note = n.text;
        r.at = later(r.at, n.updatedAt);
    }
    // A passage marked at once shares its date; the canon's order keeps its
    // verses side by side, so they can be read — and joined — as one.
    return [...rows.values()].sort((a, b) => b.at.getTime() - a.at.getTime() || position(a, b));
}

/** Whether a row carries the kind of thing a filter asks for. */
export function hasArt(stelle: Stelle, art: StellenArt): boolean {
    if (art === 'lesezeichen') return stelle.lesezeichen !== undefined;
    if (art === 'notizen') return stelle.note !== undefined;
    if (art === 'markierungen') return stelle.color !== undefined;
    return true;
}

/** A highlight and nothing else: the only kind of row that joins its neighbours. */
function bareHighlight(stelle: Stelle): boolean {
    return stelle.color !== undefined && stelle.lesezeichen === undefined && !stelle.note;
}

/**
 * Neighbouring rows of a highlighted run made one: same chapter, verses that
 * follow on, the same colour, and neither carrying a Lesezeichen or a note —
 * those stay rows of their own, since what they say is about one verse.
 */
export function joinRuns(rows: Stelle[]): Stelle[] {
    const out: Stelle[] = [];
    for (const row of rows) {
        const prev = out[out.length - 1];
        if (
            prev &&
            bareHighlight(prev) &&
            bareHighlight(row) &&
            prev.slug === row.slug &&
            prev.chapter === row.chapter &&
            prev.color === row.color &&
            row.verses[0] === prev.verses[prev.verses.length - 1] + 1
        ) {
            out[out.length - 1] = {
                ...prev,
                verses: [...prev.verses, ...row.verses],
                at: later(prev.at, row.at),
            };
        } else {
            out.push(row);
        }
    }
    return out;
}

/** "Psalm 23,1-3" for a row. */
export function stelleLabel(stelle: Stelle): string {
    return versesRefLabel(stelle, stelle.verses);
}

export interface StellenFilter {
    art: StellenArt;
    /** Only highlights of this colour. */
    farbe?: MarkierungsFarbe | null;
    /** Words in the reference, the note or the Lesezeichen's snippet. */
    query?: string;
    ordnung: StellenOrdnung;
}

/** The rows a filter leaves, in the order it asks for, runs joined. */
export function filterStellen(rows: Stelle[], filter: StellenFilter): Stelle[] {
    const words = (filter.query ?? '').toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
    const kept = rows.filter((row) => {
        if (!hasArt(row, filter.art)) return false;
        if (filter.farbe && row.color !== filter.farbe) return false;
        if (words.length === 0) return true;
        const haystack = [stelleLabel(row), row.note ?? '', row.lesezeichen ?? '']
            .join('\n')
            .toLocaleLowerCase('de');
        return words.every((word) => haystack.includes(word));
    });
    return joinRuns(filter.ordnung === 'buch' ? [...kept].sort(position) : kept);
}

export interface StellenGruppe {
    book: BibelBook;
    rows: Stelle[];
}

/** Rows in the canon's order, under the book they are in. */
export function groupByBook(rows: Stelle[]): StellenGruppe[] {
    const groups: StellenGruppe[] = [];
    for (const row of rows) {
        const last = groups[groups.length - 1];
        if (last?.book.slug === row.slug) {
            last.rows.push(row);
            continue;
        }
        const book = BIBEL_BOOKS.find((b) => b.slug === row.slug);
        if (book) groups.push({ book, rows: [row] });
    }
    return groups;
}

/**
 * What clearing a row takes away. Under a filter, only the thing filtered
 * for — clearing a Lesezeichen leaves the verse's colour and note — and under
 * „Alle", everything the verse carries.
 */
export function clearsOf(stelle: Stelle, art: StellenArt) {
    const all = art === 'alle';
    return {
        lesezeichen: (all || art === 'lesezeichen') && stelle.lesezeichen !== undefined,
        markierung: (all || art === 'markierungen') && stelle.color !== undefined,
        notiz: (all || art === 'notizen') && stelle.note !== undefined,
    };
}
