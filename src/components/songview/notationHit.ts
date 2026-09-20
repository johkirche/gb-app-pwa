/**
 * Which note a reader meant by tapping the page.
 *
 * One arithmetic for both engravings, for the same reason the band has one: the
 * Notenbild and the re-set notation put their noteheads in different places, but
 * "the note nearest what I touched" means the same thing on either.
 *
 * The row is answered before the note. A notehead is a few millimetres wide and
 * the systems are stacked close, so plain nearest-point picks the line above as
 * readily as the note aimed at; measuring to the *system* first keeps a tap
 * inside the row it landed in, and only then asks which note along it is
 * nearest. Anywhere in the row therefore works — beside a note, under it, on the
 * words below — which is what makes this usable with a thumb.
 */
import type { Rect } from './notationPlayhead';

/**
 * How far a finger may travel and still be a tap rather than a scroll, in px.
 *
 * Both engravings scroll sideways when the music is wider than the column, and
 * that drag ends in a pointerup like any other — this is what tells them apart.
 */
export const TAP_SLOP = 10;

export interface NoteTarget {
    /** Ordinal of the note, as `data-note` numbers it */
    note: number;
    /** The notehead as drawn */
    head: Rect;
    /** The system it stands in — the row a tap is answered within */
    system: Rect;
}

/** How far a point lies outside a span, zero anywhere inside it. */
function outside(value: number, from: number, to: number): number {
    if (value < from) return from - value;
    if (value > to) return value - to;
    return 0;
}

/**
 * The note nearest a point, or null where there is nothing to hit.
 *
 * Ordered by row first and position along it second, rather than by one blended
 * distance: a weight that mixed the two would need a number chosen to suit some
 * particular engraving, and the book sets its songs at every size.
 */
export function noteAtPoint(x: number, y: number, targets: readonly NoteTarget[]): number | null {
    let best: number | null = null;
    let bestRow = Infinity;
    let bestAlong = Infinity;

    for (const target of targets) {
        const row = outside(y, target.system.top, target.system.bottom);
        const along = outside(x, target.head.left, target.head.right);
        if (row > bestRow || (row === bestRow && along >= bestAlong)) continue;
        best = target.note;
        bestRow = row;
        bestAlong = along;
    }

    return best;
}

/**
 * The step that strikes a note, on the pass through it nearest `from`.
 *
 * A notehead is one note however often it is sung, so the engraving can only
 * ever name the note — which time through it is meant has to be decided here.
 * Nearest is what a reader means: a tap just ahead of the mark is the pass being
 * sung, not the first pass of a song already on its second time round, and a
 * tap behind it goes back rather than waiting for the repeat to come round.
 *
 * A run of steps holding the same note is one beat — a rest belongs to the note
 * before it — so only the step that strikes it counts as a place to land.
 */
export function stepForNote(
    stepToNote: readonly number[],
    note: number,
    from: number,
): number | null {
    let best: number | null = null;
    for (let step = 0; step < stepToNote.length; step++) {
        if (stepToNote[step] !== note) continue;
        if (step > 0 && stepToNote[step - 1] === note) continue;
        if (best === null || Math.abs(step - from) < Math.abs(best - from)) best = step;
    }
    return best;
}
