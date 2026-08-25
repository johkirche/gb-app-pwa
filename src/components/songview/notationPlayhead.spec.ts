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

    it('treats a successor standing to the left as none — a repeat jumping back', () => {
        const back = playheadBox(LAYER, SYSTEM, [rect(880, 900)], rect(40, 60), true)!;
        const none = playheadBox(LAYER, SYSTEM, [rect(880, 900)], null, true)!;

        expect(back).toEqual(none);
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
