import { BIBEL_TRANSLATION, type ChapterRef, findBook } from '@/utils/bibel';
import { type LaidBlock, verseText } from '@/utils/bibelLayout';
import { type ParsedBibelRef, findReferences } from '@/utils/bibelRef';

/**
 * What the reader does with verses once they are picked out: the reference a
 * set of them is cited by, the text a copy carries, and where in the laid-out
 * chapter each verse ends.
 */

/** A selection with one verse added, or taken out if it was in — kept in order. */
export function toggleVerse(verses: readonly number[], verse: number): number[] {
    return verses.includes(verse)
        ? verses.filter((v) => v !== verse)
        : [...verses, verse].sort((a, b) => a - b);
}

/**
 * The verse part of a citation, as German writes it: a run is "1-3", verses
 * apart are joined with a dot, so 1, 2, 3, 5 and 7 read "1-3.5.7".
 */
export function verseListLabel(verses: readonly number[]): string {
    const sorted = [...new Set(verses)].sort((a, b) => a - b);
    const parts: string[] = [];
    let start = sorted[0];
    for (let i = 0; i < sorted.length; i++) {
        const verse = sorted[i];
        if (sorted[i + 1] === verse + 1) continue;
        parts.push(start === verse ? `${verse}` : `${start}-${verse}`);
        start = sorted[i + 1];
    }
    return parts.join('.');
}

/** "Psalm 23,1-2" — or "Judas 3-4" in a book of one chapter. */
export function versesRefLabel(ref: ChapterRef, verses: readonly number[]): string {
    const book = findBook(ref.slug);
    if (!book || verses.length === 0) return '';
    const list = verseListLabel(verses);
    return book.chapters > 1 ? `${book.name} ${ref.chapter},${list}` : `${book.name} ${list}`;
}

// "Menge-Bibel (1939)" is cited by its translator's name alone, as a reader
// would write it under a quotation.
const TRANSLATION_SHORT = BIBEL_TRANSLATION.split(/[-\s]/)[0];

/**
 * The verses as a quotation with their reference: „Der HERR ist mein Hirt …"
 * (Psalm 23,1-2, Menge). Verses that follow each other run on; where the
 * selection skips some, an ellipsis says so.
 */
export function copyText(laid: LaidBlock[], ref: ChapterRef, verses: readonly number[]): string {
    const sorted = [...new Set(verses)].sort((a, b) => a - b);
    let text = '';
    sorted.forEach((verse, i) => {
        if (i > 0) text += sorted[i - 1] === verse - 1 ? ' ' : ' … ';
        text += verseText(laid, verse);
    });
    return `„${text}“ (${versesRefLabel(ref, sorted)}, ${TRANSLATION_SHORT})`;
}

/**
 * Where each verse's words end, as the `block.line.segment` key of its last
 * run of text — the place a verse's note icon stands, after the last word
 * even when the verse runs over several poetry lines.
 */
export function verseEnds(laid: LaidBlock[]): Map<string, number> {
    const last = new Map<number, string>();
    laid.forEach((block, b) => {
        if (block.kind !== 'para') return;
        block.lines.forEach((line, l) =>
            line.segments.forEach((seg, s) => {
                if ((seg.kind === 'text' || seg.kind === 'italic') && seg.verse !== null) {
                    last.set(seg.verse, `${b}.${l}.${s}`);
                }
            }),
        );
    });
    return new Map([...last].map(([verse, key]) => [key, verse]));
}

export type NotePart = { text: string; ref?: ParsedBibelRef };

/**
 * A footnote cut into plain runs and the references inside it, so each
 * reference can be a link to its passage: "vgl. Ps 130,8" becomes "vgl. " and
 * a link to Psalm 130,8.
 */
export function noteParts(text: string): NotePart[] {
    const parts: NotePart[] = [];
    let at = 0;
    for (const found of findReferences(text)) {
        if (found.start > at) parts.push({ text: text.slice(at, found.start) });
        parts.push({ text: text.slice(found.start, found.end), ref: found.ref });
        at = found.end;
    }
    if (at < text.length) parts.push({ text: text.slice(at) });
    return parts;
}
