/**
 * The map the engraved Notenbild carries.
 *
 * `gesangbuchlied.notentext_svg` is the book's own engraving, and gb-scripts
 * writes a map into it so a song can be followed across that engraving without
 * the app recomputing anything the engraver already decided — where a system
 * breaks, how a bar is split, where a syllable sits:
 *
 * - `data-note` — the ordinal of the note's `<note>` in the MusicXML, in
 *   document order, rests skipped, counted from 0. On every element the note is
 *   drawn from, not on the notehead alone — see `data-part`.
 * - `data-system` — the system the note stands in, running on across the pages
 *   of a multi-page song. On those same elements, and on an invisible `<rect>`
 *   laid over that system's five staff lines.
 * - `data-lyric` — **the ordinal of the note a syllable is sung on**, not a
 *   syllable count of its own. One number therefore keys both a notehead and
 *   the words under it.
 * - `data-verse` — the MusicXML `number` of the syllable's verse, as the
 *   string it is written as ("1", "2", "3"). Not the optical row from the top:
 *   Lied 121 sets a short third verse between the first and the second.
 * - `data-part` — which piece of a note this element draws: `head`, `stem`,
 *   `flag`, `dot` or `accidental`. All of them repeat the note's `data-note`,
 *   so the head is the one piece that has to be asked for by name.
 *
 * Neither key is written unless it could be checked against the MusicXML, so
 * both are missing from some songs — and one can be there without the other.
 * That is why everything here is asked of the loaded document and never of a
 * list of song ids.
 *
 * No coordinates are read out of the file. The geometry is resolved with
 * `getBoundingClientRect()`, which sees through the nested `<svg>` viewBoxes of
 * a multi-page montage and survives the responsive scaling.
 */

/**
 * Where a song stands, in the map's own coordinates.
 *
 * Produced once by the playback and read by whichever engraving is on screen,
 * so a switch of renderer mid-song cannot move the mark.
 */
export interface NotationMark {
    /** Ordinal of the sounding note */
    note: number;
    /** Ordinal of the note this beat runs to, or null at the end of the music */
    next: number | null;
    /** How often this note has been sung already — 0 on the first pass */
    pass: number;
    /** Whether the beat should be brought into view */
    follow: boolean;
}

/** How far a loaded Notenbild can follow a song being played. */
export type NotationMapKind =
    /** Noteheads and syllables — the note and its words can both be lit */
    | 'notes-and-lyrics'
    /** Noteheads only — the note can be lit, the words cannot */
    | 'notes'
    /** Neither — the engraving is shown, and nothing runs along it */
    | 'none';

export function notationMapKind(root: ParentNode | null | undefined): NotationMapKind {
    if (!root?.querySelector('[data-note]')) return 'none';
    return root.querySelector('[data-lyric]') ? 'notes-and-lyrics' : 'notes';
}

/** Guard for every ordinal that goes into a selector: they are ours, but a
 *  selector built from a stray value would throw rather than miss. */
function isOrdinal(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
}

/**
 * The notehead of a note, or null where this song carries no note map.
 *
 * Named through `data-part`, never taken as the first `data-note` in the
 * document: the pieces of one note all carry its ordinal, and the engraver
 * draws the stem before the head. First-match would hand back that stem for
 * three notes in four — a stroked path with `fill="none"`, where the highlight
 * has no fill to paint and the band would be measured off the wrong box.
 *
 * The bare fallback is for the engravings written before `data-part` existed,
 * where the ordinal sits on the head alone.
 */
export function noteHead(root: ParentNode, note: number): SVGGraphicsElement | null {
    if (!isOrdinal(note)) return null;
    return (
        root.querySelector<SVGGraphicsElement>(`[data-note="${note}"][data-part="head"]`) ??
        root.querySelector<SVGGraphicsElement>(`[data-note="${note}"]`)
    );
}

/** Which system a notehead stands in, as the string both it and the rect use. */
export function systemOf(head: Element | null): string | null {
    return head?.getAttribute('data-system') ?? null;
}

/** The invisible rectangle over a system's five staff lines — the band's box. */
export function systemRect(root: ParentNode, system: string | null): SVGGraphicsElement | null {
    if (!system || !/^\d+$/.test(system)) return null;
    return root.querySelector<SVGGraphicsElement>(`rect[data-system="${system}"]`);
}

/**
 * The verse numbers written at a note, ascending.
 *
 * Read off the document rather than assumed: a note can carry "2" and "3"
 * without carrying "1", so counting rows from the top would name the wrong one.
 */
export function versesAtNote(root: ParentNode, note: number): string[] {
    if (!isOrdinal(note)) return [];
    const written = Array.from(
        root.querySelectorAll(`[data-lyric="${note}"]`),
        (element) => element.getAttribute('data-verse') ?? '',
    ).filter(Boolean);
    return [...new Set(written)].sort((a, b) => Number(a) - Number(b));
}

/**
 * Which of a note's verses is being sung on the given pass through it.
 *
 * The pass is what a repeat produces: the same notehead, sung a second time
 * with the words of the line below. Beyond the last verse the last one holds —
 * a song can be written to repeat more often than it has lines.
 */
export function verseForPass(verses: readonly string[], pass: number): string | null {
    if (!verses.length) return null;
    return verses[Math.min(Math.max(0, pass), verses.length - 1)];
}

/**
 * The syllables of one verse sung on one note.
 *
 * `querySelectorAll`, never `querySelector`: the engraving draws a whole run of
 * text as one object and gb-scripts cuts it apart again, so a syllable *may*
 * fall to more than one `<path>` — it happens nowhere in today's stock, and the
 * day it does the highlight must not light half a word.
 */
export function syllables(root: ParentNode, note: number, verse: string | null): Element[] {
    if (!isOrdinal(note) || !verse || !/^[\w.-]+$/.test(verse)) return [];
    return Array.from(root.querySelectorAll(`[data-lyric="${note}"][data-verse="${verse}"]`));
}
