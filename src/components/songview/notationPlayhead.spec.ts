import { describe, expect, it } from 'vitest';

import { PLAYHEAD_GAP_RATIO, type Rect, playheadBox } from './notationPlayhead';

/** Defaults to a notehead sitting on the staff, which is where most of them are. */
function rect(left: number, right: number, top = 130, bottom = 145): Rect {
    return { left, right, top, bottom, height: bottom - top };
}

const LAYER = rect(0, 1000, 0, 500);
const SYSTEM = rect(20, 920, 100, 200);
const GAP = SYSTEM.height * PLAYHEAD_GAP_RATIO;

describe('playheadBox', () => {
    it('runs the band from the sounding note up to where the next one starts', () => {
        const box = playheadBox(LAYER, SYSTEM, [rect(200, 220)], rect(300, 320), true)!;

        expect(box.left).toBe(200 - GAP);
        expect(box.width).toBe(300 - GAP - (200 - GAP));
        // Note centre to note centre, so the line stands on the notehead as it
        // is struck rather than beside it.
        expect(box.from).toBe(210);
        expect(box.to).toBe(310);
    });

    it('stands at the system, for a note that sits on the staff', () => {
        const box = playheadBox(LAYER, SYSTEM, [rect(200, 220, 130, 140)], null, true)!;

        expect(box.top).toBe(SYSTEM.top);
        expect(box.height).toBe(SYSTEM.height);
    });

    it('grows to hold a note hanging off the staff on a ledger line', () => {
        const low = playheadBox(LAYER, SYSTEM, [rect(200, 220, 190, 215)], null, true)!;
        expect(low.top).toBe(SYSTEM.top);
        expect(low.top + low.height).toBe(215);

        const high = playheadBox(LAYER, SYSTEM, [rect(200, 220, 84, 96)], null, true)!;
        expect(high.top).toBe(84);
        expect(high.top + high.height).toBe(SYSTEM.bottom);
    });

    it('runs to the end of the system where no note follows on it', () => {
        const box = playheadBox(LAYER, SYSTEM, [rect(880, 900)], null, true)!;

        expect(box.to).toBe(SYSTEM.right + GAP);
        expect(box.left + box.width).toBeCloseTo(SYSTEM.right);
    });

    it('treats a neighbour standing to the left as none — nothing follows on this system', () => {
        const back = playheadBox(LAYER, SYSTEM, [rect(880, 900)], rect(40, 60), true)!;
        const none = playheadBox(LAYER, SYSTEM, [rect(880, 900)], null, true)!;

        expect(back).toEqual(none);
    });

    // Lied 274 „Ich komme voller Fragen", second time through: the music leaves
    // note 26 for note 29, skipping the 1. Klammer. Bounding the band by the
    // note *sung* next stretched it from 26 all the way to 29 — 94 units where
    // a beat there is 30 — laying the mark over notes 27 and 28, which at that
    // moment are silent. It stops at the Klammer instead.
    it('stops at the 1. Klammer when the music jumps forward over it', () => {
        const sounding = rect(140, 160);
        const klammer = rect(171, 191); // note 27, printed next, not sung next
        const afterKlammer = rect(234, 254); // note 29, what the music goes to

        const box = playheadBox(LAYER, SYSTEM, [sounding], klammer, true)!;

        expect(box.left + box.width).toBe(171 - GAP);
        expect(box.to).toBe((171 + 191) / 2);
        // The band that bounding by sung order drew, for contrast.
        const sung = playheadBox(LAYER, SYSTEM, [sounding], afterKlammer, true)!;
        expect(sung.width).toBeGreaterThan(box.width * 2);
    });

    // The same mistake pointing the other way, and the commoner one: 49 songs
    // put the repeat barline mid-system. The note before it has nothing sung
    // after it on this system — the music jumps back — so the beat ran on to
    // the end of the line, covering every bar printed after the barline.
    it('stops at the next note printed when the music jumps back over a repeat', () => {
        const beforeBarline = rect(200, 220);
        const afterBarline = rect(300, 320);

        const box = playheadBox(LAYER, SYSTEM, [beforeBarline], afterBarline, true)!;

        expect(box.left + box.width).toBe(300 - GAP);
        expect(box.to).toBe(310);
    });

    // A chord is one sounding, so its own noteheads bound nothing: they share
    // the beat rather than ending it.
    it('is not bounded by a neighbour overlapping the note that is sounding', () => {
        const box = playheadBox(LAYER, SYSTEM, [rect(200, 220)], rect(210, 230), true)!;
        const none = playheadBox(LAYER, SYSTEM, [rect(200, 220)], null, true)!;

        expect(box).toEqual(none);
    });

    it('spans every notehead of a chord', () => {
        const box = playheadBox(LAYER, SYSTEM, [rect(200, 220), rect(196, 216)], null, true)!;

        expect(box.left).toBe(196 - GAP);
        expect(box.from).toBe((196 + 220) / 2);
    });

    it('is measured against the layer it is drawn in, not against the page', () => {
        const shifted = rect(100, 1100, 50, 550);
        const box = playheadBox(shifted, SYSTEM, [rect(200, 220)], rect(300, 320), true)!;

        expect(box.left).toBe(200 - GAP - 100);
        expect(box.top).toBe(SYSTEM.top - 50);
    });

    it('has nothing to draw without a note', () => {
        expect(playheadBox(LAYER, SYSTEM, [], null, true)).toBeNull();
    });

    it('carries through whether the band may slide there', () => {
        expect(playheadBox(LAYER, SYSTEM, [rect(0, 10)], null, false)!.animate).toBe(false);
        expect(playheadBox(LAYER, SYSTEM, [rect(0, 10)], null, true)!.animate).toBe(true);
    });
});
