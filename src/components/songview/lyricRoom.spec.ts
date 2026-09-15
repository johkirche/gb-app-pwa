import type {
    GraphicalMeasure,
    MusicSheetCalculator,
    OpenSheetMusicDisplay,
} from 'opensheetmusicdisplay';
import { describe, expect, it, vi } from 'vitest';

import { LYRIC_ELONGATION_LIMIT, reserveLyricRoom, widthWithLyricRoom } from './lyricRoom';

// The book's density, as applyEngravingTweaks sets it
const rules = { VoiceSpacingMultiplierVexflow: 0.25, VoiceSpacingAddendVexflow: 0.3 };

function measure(xs: number[], implicit = false): GraphicalMeasure {
    return {
        parentSourceMeasure: { ImplicitMeasure: implicit },
        staffEntries: xs.map((x) => ({ PositionAndShape: { RelativePosition: { x } } })),
    } as unknown as GraphicalMeasure;
}

/** A width pass that records where it found the notes and widens by a fixed factor */
function passSeeing(seen: number[][], factor = 1) {
    return vi.fn(function (this: unknown, measures: GraphicalMeasure[], tight: number) {
        seen.push(
            measures.flatMap((m) =>
                m.staffEntries.map((e) => e.PositionAndShape.RelativePosition.x),
            ),
        );
        return tight * factor;
    });
}

const calculator = {} as MusicSheetCalculator;

describe('widthWithLyricRoom', () => {
    // Four quarter notes: VexFlow lays them out 3 apart from x=2, i.e. in a
    // width of about 12, and OSMD shrinks that to 12 * 0.25 + 0.3 + 4 * 0.3 = 4.5.
    const laidOut = [2, 5, 8, 11];
    const tight = 12 * 0.25 + 0.3 + 4 * 0.3;

    it('hands the pass the notes in the width it is widening, and puts them back', () => {
        const m = measure(laidOut);
        const seen: number[][] = [];
        widthWithLyricRoom(rules, calculator, passSeeing(seen), [m], tight);
        // First note stays; every gap shrinks by 4.5 / 12.
        const ratio = tight / 12;
        expect(seen[0]).toEqual(laidOut.map((x) => 2 + (x - 2) * ratio));
        expect(m.staffEntries.map((e) => e.PositionAndShape.RelativePosition.x)).toEqual(laidOut);
    });

    it('returns whatever the pass decided, in the tight units', () => {
        const width = widthWithLyricRoom(
            rules,
            calculator,
            passSeeing([], 4),
            [measure(laidOut)],
            tight,
        );
        expect(width).toBeCloseTo(tight * 4, 9);
    });

    it('restores the notes even when the pass throws', () => {
        const m = measure(laidOut);
        const failing = () => {
            throw new Error('no');
        };
        expect(() => widthWithLyricRoom(rules, calculator, failing, [m], tight)).toThrow('no');
        expect(m.staffEntries.map((e) => e.PositionAndShape.RelativePosition.x)).toEqual(laidOut);
    });

    // At OSMD's own spacing the shrunken figure is not narrower than the notes
    const loose = { VoiceSpacingMultiplierVexflow: 0.85, VoiceSpacingAddendVexflow: 3 };

    it.each([
        ['a pickup measure', measure(laidOut, true), rules],
        ['a measure with one note', measure([2]), rules],
        ['a measure the notes already fill', measure(laidOut), loose],
    ])('leaves %s to OSMD as it is', (_, m, spacing) => {
        const seen: number[][] = [];
        widthWithLyricRoom(spacing, calculator, passSeeing(seen), [m], tight);
        expect(seen[0]).toEqual(m.staffEntries.map((e) => e.PositionAndShape.RelativePosition.x));
    });
});

describe('reserveLyricRoom', () => {
    function sheet() {
        const seen: number[][] = [];
        const calc = { calculateMeasureWidthFromStaffEntries: passSeeing(seen) };
        const osmd = {
            EngravingRules: rules,
            GraphicSheet: { GetCalculator: calc },
        } as unknown as OpenSheetMusicDisplay;
        return { osmd, calc, seen };
    }

    it('wraps the calculator once and follows the switch', () => {
        const { osmd, calc, seen } = sheet();
        const original = calc.calculateMeasureWidthFromStaffEntries;
        const m = measure([2, 5, 8, 11]);

        reserveLyricRoom(osmd, true);
        const wrapped = calc.calculateMeasureWidthFromStaffEntries;
        expect(wrapped).not.toBe(original);
        calc.calculateMeasureWidthFromStaffEntries([m], 4.5);
        expect(seen[0][3]).toBeLessThan(11);

        reserveLyricRoom(osmd, false);
        expect(calc.calculateMeasureWidthFromStaffEntries).toBe(wrapped);
        calc.calculateMeasureWidthFromStaffEntries([m], 4.5);
        expect(seen[1]).toEqual([2, 5, 8, 11]);
        expect(original).toHaveBeenCalledTimes(2);
    });

    it('does nothing before a sheet is loaded', () => {
        expect(() => reserveLyricRoom({} as OpenSheetMusicDisplay, true)).not.toThrow();
    });

    it('lets a measure grow well past OSMD’s own limit', () => {
        expect(LYRIC_ELONGATION_LIMIT).toBeGreaterThan(2.5);
    });
});
