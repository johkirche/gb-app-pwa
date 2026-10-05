import type { Block } from '@/utils/bibel';
import {
    type LaidBlock,
    type LaidSegment,
    layoutChapter,
    verseText,
    versesOf,
} from '@/utils/bibelLayout';

/**
 * A second translation set beside Menge, verse by verse.
 *
 * Menge leads: its headings, its verse order and its numbering are the page's,
 * and every mark a reader sets belongs to its verses. The second text is
 * matched to them by verse number, and where the two do not meet — a verse
 * only one of them has, or one Menge folds into its neighbour — the gap is
 * shown as a gap rather than papered over.
 */

// --- The second text, addressed by Menge's numbering ------------------------------

/** One verse of the second translation, filed under the verse it sits beside. */
export interface SecondaryVerse {
    /** Menge's verse number for it, in the chapter on screen. */
    verse: number;
    /** Where the translation itself puts it, which may be another chapter. */
    own: { chapter: number; verse: number };
    text: string;
}

/**
 * The Lutherbibel's source notes, where its numbering parts from the Hebrew
 * one, the Hebrew place at the start of the verse: Joel 2,32 begins "[3:5]",
 * Maleachi 4,1 "[3:19]". Menge numbers by the Hebrew text there, so the note
 * is where the verse belongs on Menge's page.
 */
const OTHER_PLACE = /^\s*\[(\d+):(\d+)\]\s*/;

interface BookVerse {
    own: { chapter: number; verse: number };
    /** The Hebrew place the source gives, if it gives one. */
    other: { chapter: number; verse: number } | null;
    text: string;
}

const bookVerses = new WeakMap<Block[][], BookVerse[]>();

/** Every verse of a book with words in it, its place note taken off the text. */
function versesOfBook(chapters: Block[][]): BookVerse[] {
    let found = bookVerses.get(chapters);
    if (!found) {
        found = chapters.flatMap((blocks, index) => {
            const laid = layoutChapter(blocks);
            return versesOf(laid).flatMap((verse): BookVerse[] => {
                const raw = verseText(laid, verse);
                const note = OTHER_PLACE.exec(raw);
                const text = note ? raw.slice(note[0].length) : raw;
                if (!text) return [];
                return [
                    {
                        own: { chapter: index + 1, verse },
                        other: note ? { chapter: Number(note[1]), verse: Number(note[2]) } : null,
                        text,
                    },
                ];
            });
        });
        bookVerses.set(chapters, found);
    }
    return found;
}

/** How many of Menge's verses a candidate meets, less the ones it brings that Menge lacks. */
function fit(candidate: Map<number, SecondaryVerse>, primary: Set<number>): number {
    let score = 0;
    for (const verse of candidate.keys()) score += primary.has(verse) ? 1 : -1;
    return score;
}

/**
 * The second translation's verses for one of Menge's chapters, keyed by
 * Menge's verse number — or null when it has nothing for that chapter.
 *
 * Two readings are tried. Plainly, the chapter of the same number, verse for
 * verse. Or by the source's own place notes, which move the verses Luther
 * counts differently to where the Hebrew numbering — Menge's, mostly — has
 * them: Joel 3 is then Luther's 2,28–32 rather than his chapter 3, which is
 * Menge's 4. Whichever fits Menge's verses better is taken; a tie keeps the
 * plain one, since there are chapters where Menge follows Luther's count and
 * the notes would lead astray.
 */
export function secondaryVerses(
    chapters: Block[][],
    chapter: number,
    primaryVerses: readonly number[],
): Map<number, SecondaryVerse> | null {
    const verses = versesOfBook(chapters);

    const plain = new Map<number, SecondaryVerse>();
    const noted = new Map<number, SecondaryVerse>();
    for (const { own, other, text } of verses) {
        if (own.chapter === chapter) plain.set(own.verse, { verse: own.verse, own, text });
        const place = other ?? own;
        if (place.chapter === chapter) noted.set(place.verse, { verse: place.verse, own, text });
    }

    const primary = new Set(primaryVerses);
    const best = fit(noted, primary) > fit(plain, primary) ? noted : plain;
    return best.size > 0 ? best : null;
}

/** Luther's own reference for a verse, where it is not the one beside it: "2,28", or "4". */
export function ownNumber(entry: SecondaryVerse, chapter: number): string | null {
    if (entry.own.chapter !== chapter) return `${entry.own.chapter},${entry.own.verse}`;
    return entry.own.verse !== entry.verse ? String(entry.own.verse) : null;
}

// --- Rows --------------------------------------------------------------------------

/** A verse's share of one of Menge's lines. */
export interface ParallelPiece {
    /** Where in the chapter's layout the line is, for keys and note markers. */
    key: string;
    poetry: boolean;
    indent: number;
    segments: LaidSegment[];
}

export type ParallelRow =
    | { kind: 'heading'; level: number; text: string }
    | {
          kind: 'verse';
          /**
           * Menge's verses in the row: one, or a few when Menge gives a verse
           * no words of its own and folds it into the next. Empty only for
           * words before the chapter's first verse number.
           */
          verses: number[];
          /** Menge's text, line by line; empty where only the second text has the verse. */
          primary: ParallelPiece[];
          /** The second text's verses; empty where it lacks them. */
          secondary: SecondaryVerse[];
      };

type VerseRow = Extract<ParallelRow, { kind: 'verse' }>;

function hasWords(row: VerseRow): boolean {
    return row.primary.some((piece) =>
        piece.segments.some(
            (seg) => (seg.kind === 'text' || seg.kind === 'italic') && seg.text.trim() !== '',
        ),
    );
}

/** Menge's chapter cut into rows at its verse numbers, headings between them. */
function primaryRows(laid: LaidBlock[]): ParallelRow[] {
    const rows: ParallelRow[] = [];
    let row: VerseRow | null = null;

    laid.forEach((block, b) => {
        if (block.kind === 'heading') {
            rows.push({ kind: 'heading', level: block.level, text: block.text });
            row = null;
            return;
        }
        block.lines.forEach((line, l) => {
            let piece: ParallelPiece | null = null;
            line.segments.forEach((seg) => {
                if (seg.kind === 'verse') {
                    // A verse Menge left wordless rides along with the next
                    // one rather than standing as an empty row.
                    if (row && row.verses.length > 0 && !hasWords(row)) {
                        row.verses.push(seg.verse);
                    } else {
                        row = { kind: 'verse', verses: [seg.verse], primary: [], secondary: [] };
                        rows.push(row);
                        piece = null;
                    }
                }
                if (!row) {
                    row = { kind: 'verse', verses: [], primary: [], secondary: [] };
                    rows.push(row);
                }
                if (!piece) {
                    piece = {
                        key: `${b}.${l}.${row.primary.length}`,
                        poetry: block.poetry,
                        indent: line.indent,
                        segments: [],
                    };
                    row.primary.push(piece);
                }
                piece.segments.push(seg);
            });
        });
    });
    return rows;
}

/**
 * Menge's chapter and the second text's verses as rows that line up: each of
 * Menge's verses with its counterpart, Menge's headings across both columns,
 * and the verses only the second text has slotted in by number — after the
 * highest of Menge's verses below them.
 *
 * A verse number Menge repeats (it happens once, at the foot of 2. Mose 21)
 * gets the counterpart only the first time.
 */
export function parallelRows(
    laid: LaidBlock[],
    secondary: ReadonlyMap<number, SecondaryVerse>,
): ParallelRow[] {
    const rows = primaryRows(laid);
    const placed = new Set<number>();

    for (const row of rows) {
        if (row.kind !== 'verse') continue;
        for (const verse of row.verses) {
            const entry = secondary.get(verse);
            if (entry && !placed.has(verse)) {
                row.secondary.push(entry);
                placed.add(verse);
            }
        }
    }

    const extra = [...secondary.values()]
        .filter((entry) => !placed.has(entry.verse))
        .sort((a, b) => a.verse - b.verse);
    if (extra.length === 0) return rows;

    // Each extra verse goes after the row holding the highest verse below it.
    const after = new Map<number, VerseRow[]>();
    const before: VerseRow[] = [];
    for (const entry of extra) {
        const own: VerseRow = {
            kind: 'verse',
            verses: [entry.verse],
            primary: [],
            secondary: [entry],
        };
        let anchor = -1;
        let highest = -Infinity;
        rows.forEach((row, index) => {
            if (row.kind !== 'verse' || row.primary.length === 0) return;
            for (const verse of row.verses) {
                if (verse < entry.verse && verse > highest) {
                    highest = verse;
                    anchor = index;
                }
            }
        });
        if (anchor < 0) before.push(own);
        else after.set(anchor, [...(after.get(anchor) ?? []), own]);
    }

    const result: ParallelRow[] = [];
    // Before the chapter's first verse, but under the headings that open it.
    let opening = true;
    rows.forEach((row, index) => {
        if (opening && row.kind === 'verse') {
            result.push(...before);
            opening = false;
        }
        result.push(row, ...(after.get(index) ?? []));
    });
    if (opening) result.push(...before);
    return result;
}
