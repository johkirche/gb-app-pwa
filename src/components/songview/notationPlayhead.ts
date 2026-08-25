/**
 * Where the band behind the staff sits, and how far the line has swept across it.
 *
 * One arithmetic for both engravings. The band marks which note is sounding —
 * it runs from that note up to where the next one starts, or to the end of the
 * system when there is none — and the line carries the time *inside* that note,
 * crossing the notehead as it is struck and reaching the next one exactly as
 * the band moves on.
 *
 * What differs between the two views is only where the rectangles come from:
 * the Notenbild hands over the invisible system `<rect>` gb-scripts laid over
 * the staff lines, the re-set notation the bounding box of its stafflines.
 */

/** The part of a DOMRect this needs — so a union of several can be passed too. */
export interface Rect {
    left: number;
    right: number;
    top: number;
    bottom: number;
    height: number;
}

export interface PlayheadBox {
    left: number;
    top: number;
    width: number;
    height: number;
    /** Where the sweeping line crosses when this beat starts and when the next one does */
    from: number;
    to: number;
    /** False when the band lands on another system — sliding there reads as noise */
    animate: boolean;
}

/** Air kept around the band, as a share of the system's height */
export const PLAYHEAD_GAP_RATIO = 0.035;

/**
 * @param layer     the positioned box both marks are drawn in
 * @param system    the system the sounding note stands in
 * @param notes     the noteheads sounding — more than one on a chord
 * @param successor the next notehead, or null when the beat runs to the system's end
 * @param animate   whether to slide there, i.e. whether the system is unchanged
 */
export function playheadBox(
    layer: Rect,
    system: Rect,
    notes: readonly Rect[],
    successor: Rect | null,
    animate: boolean,
): PlayheadBox | null {
    if (!notes.length) return null;

    let noteLeft = Infinity;
    let noteRight = -Infinity;
    // The Notenbild's system rectangle is the five staff lines and nothing else,
    // and roughly one hymn note in ten hangs off them on a ledger line. The band
    // marks which note is sounding, so it has to hold that note: the staff is
    // the floor of its height, not the whole of it. (The re-set notation hands
    // over a staffline box that already contains its notes, so this changes
    // nothing there.)
    let top = system.top;
    let bottom = system.bottom;
    for (const note of notes) {
        noteLeft = Math.min(noteLeft, note.left);
        noteRight = Math.max(noteRight, note.right);
        top = Math.min(top, note.top);
        bottom = Math.max(bottom, note.bottom);
    }

    // The band holds for as long as the note sounds, so it runs up to where the
    // next one starts — or to the end of the system, when there is none. A
    // successor standing to the LEFT is a repeat jumping back within one
    // system: nothing bounds this beat there either, so it runs to the end.
    const gap = system.height * PLAYHEAD_GAP_RATIO;
    const ahead = successor && successor.left >= noteLeft ? successor : null;
    const runsTo = ahead ? ahead.left : system.right + gap;
    const start = noteLeft - gap;
    const end = Math.max(runsTo - gap, noteRight + gap);

    return {
        left: start - layer.left,
        top: top - layer.top,
        width: Math.max(0, end - start),
        height: bottom - top,
        // The line travels note centre to note centre, so it stands on the
        // notehead at the moment that note is struck rather than beside it.
        from: (noteLeft + noteRight) / 2 - layer.left,
        to: (ahead ? (ahead.left + ahead.right) / 2 : system.right + gap) - layer.left,
        animate,
    };
}
