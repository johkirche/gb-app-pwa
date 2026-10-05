import type { Block } from '@/utils/bibel';
import { type LaidBlock, verseText, versesOf } from '@/utils/bibelLayout';

/**
 * The decisions behind the chapter page — when a swipe turns the page, which
 * verse is the one on screen, what is read aloud and where a book's sections
 * start — kept apart from the DOM so they can be tested on their own.
 */

// --- Swipe -------------------------------------------------------------------

export interface SwipeGesture {
    /** Where the finger went down, from the left edge of the viewport. */
    startX: number;
    dx: number;
    dy: number;
    /** How long the finger was down, in ms. */
    ms: number;
    /** The viewport's width, so a swipe from either edge can be left alone. */
    width: number;
}

/** Far enough that a wobble while scrolling never turns the page. */
export const SWIPE_MIN_DISTANCE = 60;
/** A swipe is a flick; a finger resting and dragging is reading or selecting. */
export const SWIPE_MAX_MS = 700;
/**
 * The system's own back gesture starts at the screen's edge (iOS, Android's
 * gesture navigation), and must not turn the page as well.
 */
export const SWIPE_EDGE = 24;

/**
 * Which way a finished gesture turns the page, if at all. Leftwards is on to
 * the next chapter, as a book's page is turned. Only a clearly horizontal
 * stroke counts: anything with as much as half its travel vertical is a
 * scroll, and the page should stay where it is.
 */
export function swipeTurn(gesture: SwipeGesture): 'next' | 'prev' | null {
    const { startX, dx, dy, ms, width } = gesture;
    if (ms > SWIPE_MAX_MS) return null;
    if (startX < SWIPE_EDGE || startX > width - SWIPE_EDGE) return null;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
    if (Math.abs(dx) < 2 * Math.abs(dy)) return null;
    return dx < 0 ? 'next' : 'prev';
}

// --- The verse on screen -------------------------------------------------------

/** A verse number's position, from getBoundingClientRect. */
export interface VersePosition {
    verse: number;
    top: number;
}

/**
 * The verse being read at the top of the view: the last one whose number sits
 * at or above the top edge — its words run on below it — or, when no number
 * has reached the edge yet, the chapter's first. `slack` lets a number that is
 * only just under the edge count as there: half a line is no reason to say
 * the verse above it is the one being read.
 */
export function verseAtTop(positions: VersePosition[], viewTop: number, slack = 0): number | null {
    if (positions.length === 0) return null;
    let found = positions[0].verse;
    for (const { verse, top } of positions) {
        if (top <= viewTop + slack) found = verse;
        else break;
    }
    return found;
}

// --- Vorlesen ------------------------------------------------------------------

export interface SpokenVerse {
    verse: number;
    text: string;
}

/**
 * What is read aloud, verse by verse, from `from` on (or from the start).
 * Footnotes and verse numbers are left out — the voice reads the text as it
 * would be read from a lectern — and a verse with no words of its own (Menge
 * folds a few into their neighbours) is skipped rather than read as a pause.
 */
export function readAloudQueue(laid: LaidBlock[], from?: number | null): SpokenVerse[] {
    const verses = versesOf(laid);
    const start = from ? Math.max(0, verses.indexOf(from)) : 0;
    return verses
        .slice(start)
        .map((verse) => ({ verse, text: verseText(laid, verse) }))
        .filter((entry) => entry.text.length > 0);
}

// --- Inhalt ----------------------------------------------------------------------

export interface ContentsEntry {
    level: number;
    text: string;
    chapter: number;
    /** The first verse under the heading, when it is not the chapter's first. */
    verse?: number;
}

/**
 * A book's table of contents: Menge's main divisions and sections (levels 2
 * and 3), each with the place it starts. The subsections (level 4) are left
 * out — in the Psalms and the letters they would make the list as long as the
 * book.
 */
export function bookContents(chapters: Block[][], maxLevel = 3): ContentsEntry[] {
    const entries: ContentsEntry[] = [];
    // Headings waiting for the verse that follows them.
    let waiting: ContentsEntry[] = [];

    chapters.forEach((blocks, index) => {
        const chapter = index + 1;
        for (const block of blocks) {
            if ('h' in block) {
                if (block.h <= maxLevel) {
                    const entry: ContentsEntry = { level: block.h, text: block.t, chapter };
                    entries.push(entry);
                    waiting.push(entry);
                }
                continue;
            }
            if (waiting.length === 0) continue;
            const first = firstVerse(block);
            if (first === null) continue;
            for (const entry of waiting) {
                // A heading left at the foot of a chapter belongs to the text
                // it introduces, which starts the next one.
                entry.chapter = chapter;
                // A heading at the very top of a chapter is the chapter itself.
                if (first > 1) entry.verse = first;
            }
            waiting = [];
        }
    });

    return entries;
}

function firstVerse(block: Block): number | null {
    if ('h' in block) return null;
    for (const line of block.p) {
        for (const seg of line.s) {
            if (typeof seg === 'object' && 'v' in seg) return seg.v;
        }
    }
    return null;
}
