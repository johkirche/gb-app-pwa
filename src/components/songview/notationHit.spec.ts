import { describe, expect, it } from 'vitest';

import { type NoteTarget, noteAtPoint, stepForNote } from './notationHit';
import type { Rect } from './notationPlayhead';

function rect(left: number, right: number, top: number, bottom: number): Rect {
    return { left, right, top, bottom, height: bottom - top };
}

// Two systems stacked the way a Notenbild stacks them, four notes on each.
const UPPER = rect(20, 400, 100, 130);
const LOWER = rect(20, 400, 200, 230);

function row(system: Rect, from: number, at: readonly number[]): NoteTarget[] {
    return at.map((x, index) => ({
        note: from + index,
        head: rect(x, x + 12, system.top + 8, system.top + 20),
        system,
    }));
}

const TARGETS: NoteTarget[] = [
    ...row(UPPER, 0, [40, 120, 200, 300]),
    ...row(LOWER, 4, [40, 120, 200, 300]),
];

describe('noteAtPoint', () => {
    it('answers the note tapped', () => {
        expect(noteAtPoint(124, 112, TARGETS)).toBe(1);
        expect(noteAtPoint(304, 212, TARGETS)).toBe(7);
    });

    it('answers the nearest note along the row, for a tap beside one', () => {
        // Between notes 1 (120) and 2 (200), nearer 1.
        expect(noteAtPoint(150, 115, TARGETS)).toBe(1);
        // …and nearer 2.
        expect(noteAtPoint(190, 115, TARGETS)).toBe(2);
    });

    // A thumb lands under the staff as often as on it, and the words sit there.
    it('stays in the row for a tap below the staff but inside it', () => {
        expect(noteAtPoint(204, 129, TARGETS)).toBe(2);
    });

    // The row is settled before the note: the nearest notehead by plain distance
    // to a tap low in the upper system can easily be one in the lower.
    it('keeps a tap in the system it landed in, not the nearer notehead', () => {
        // Directly on note 2's x, at the very bottom of the upper system. Note 6
        // sits at the same x, and its head is nearer this point than note 2's.
        expect(noteAtPoint(206, 130, TARGETS)).toBe(2);
        expect(noteAtPoint(206, 200, TARGETS)).toBe(6);
    });

    it('reaches past the last note of a row for a tap in the empty end of it', () => {
        expect(noteAtPoint(395, 115, TARGETS)).toBe(3);
    });

    it('takes the nearer row for a tap in the gap between two', () => {
        expect(noteAtPoint(124, 140, TARGETS)).toBe(1);
        expect(noteAtPoint(124, 190, TARGETS)).toBe(5);
    });

    it('has nothing to answer on a sheet it cannot read', () => {
        expect(noteAtPoint(100, 100, [])).toBeNull();
    });

    // 166 is exactly 34 from note 1's right edge and from note 2's left.
    it('keeps the earlier of two notes a tap is equally near', () => {
        expect(noteAtPoint(166, 115, TARGETS)).toBe(1);
    });
});

describe('stepForNote', () => {
    // Three notes sung twice and then a fourth, the shape a repeat makes of the
    // step table: one notehead, two places in the music to land on.
    const REPEATED = [0, 1, 2, 0, 1, 2, 3];

    it('lands on the pass nearest where the music stands', () => {
        expect(stepForNote(REPEATED, 1, 0)).toBe(1);
        expect(stepForNote(REPEATED, 1, 6)).toBe(4);
    });

    it('goes back within the pass being sung, not to the top of the song', () => {
        // Standing on step 5, the second time through, a tap on note 0 means
        // this pass's note 0 at step 3 — not the first pass's at step 0.
        expect(stepForNote(REPEATED, 0, 5)).toBe(3);
    });

    it('takes the second pass once it is the nearer one', () => {
        expect(stepForNote(REPEATED, 1, 3)).toBe(4);
    });

    // A rest after a note is part of that note's beat: the band stays put and
    // goes on covering the silence, so those steps are not places to land.
    it('lands where the note is struck, not inside the silence after it', () => {
        expect(stepForNote([0, 0, 0, 1], 0, 3)).toBe(0);
    });

    it('has nowhere to send a note the music never sounds', () => {
        expect(stepForNote(REPEATED, 9, 0)).toBeNull();
        expect(stepForNote([], 0, 0)).toBeNull();
    });
});
