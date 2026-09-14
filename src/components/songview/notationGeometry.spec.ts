import { describe, expect, it } from 'vitest';

import {
    PRINT_BLOCK_WIDTH_PT,
    PRINT_HOST_PX,
    PRINT_SIDE_MARGIN,
    PRINT_STAFF_SPACE_PT,
    reflowZoomFor,
} from './notationGeometry';

describe('the printed page in OSMD units', () => {
    it('measures the block as the staff spaces it actually holds', () => {
        // 249.44pt of block at 3.81pt a staff space is 65.5 of them, and OSMD
        // draws each as 10px at zoom 1.
        expect(PRINT_HOST_PX / 10).toBeCloseTo(PRINT_BLOCK_WIDTH_PT / PRINT_STAFF_SPACE_PT, 6);
    });

    it('leaves the system its printed margins', () => {
        // 249.44 block, 240.96 system: 4.24pt a side, which is 1.11 staff spaces.
        expect(PRINT_SIDE_MARGIN).toBeCloseTo(4.24 / PRINT_STAFF_SPACE_PT, 6);
    });
});

describe('reflowZoomFor', () => {
    it('draws the printed page at its printed size', () => {
        expect(reflowZoomFor(PRINT_HOST_PX)).toBe(1);
    });

    // The whole point of the conversion: one Notengröße has to mean one size in
    // both views, so that crossing the fit width changes where the lines break
    // and nothing else.
    it('gives a staff space the size the scale asks for', () => {
        for (const [column, scale] of [
            [360, 1.25],
            [360, 2],
            [700, 1.5],
        ]) {
            const drawnWidth = column * scale;
            // What the Notenbild draws it at: the printed staff space, in a
            // block scaled to drawnWidth.
            const wanted = PRINT_STAFF_SPACE_PT * (drawnWidth / PRINT_BLOCK_WIDTH_PT);
            // What OSMD draws it at: 10px a staff space, times the zoom.
            expect(10 * reflowZoomFor(drawnWidth)).toBeCloseTo(wanted, 6);
        }
    });

    it('scales with the width and nothing else', () => {
        expect(reflowZoomFor(800)).toBeCloseTo(2 * reflowZoomFor(400), 10);
    });
});
