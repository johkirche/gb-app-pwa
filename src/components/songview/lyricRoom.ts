import type {
    EngravingRules,
    GraphicalMeasure,
    MusicSheetCalculator,
    OpenSheetMusicDisplay,
} from 'opensheetmusicdisplay';

/**
 * Give the lyrics their room when the sheet is set on the reader's width.
 *
 * OSMD sizes a measure in two steps. First it asks VexFlow for the narrowest
 * width the notes can be laid out in, and shrinks that figure with
 * `VoiceSpacingMultiplierVexflow` and `VoiceSpacingAddendVexflow` — the two
 * rules the notation view tightens to the book's density (see
 * `applyEngravingTweaks`). Then it lays the lyrics under the notes and widens
 * the figure by however much the words need more than the notes.
 *
 * The second step assumes the notes actually sit in the width the first step
 * produced — and they do not. VexFlow will not squeeze notes closer than its
 * own minimum, so with the multiplier at a quarter the notes stay four times
 * as far apart as the figure says. The words are then measured against those
 * roomy positions, found to fit, and the measure keeps a minimum a quarter of
 * what the lyrics need. Squeezed to that minimum on a phone, the words run
 * into each other.
 *
 * On the printed page this never shows: the book's breaks are honoured and
 * every system is stretched to the block, so the minimum only decides whether
 * a requested system fits, and the tightened figure is what makes 58 of 60
 * songs break where the book does. Past the fit width the minimum IS the
 * layout — it decides how many measures share a line — and it has to tell the
 * truth about the words.
 *
 * So, while reflowing, the note positions are handed to the second step in
 * the width the first step claimed, every one scaled by the same ratio the
 * figure was. That is the world the step reasons in — a measure that holds
 * its notes in proportion and moves every one of them when it is widened —
 * and in it the widening comes out in the units it is applied to, so the
 * measure ends up as wide as its words. Pickup measures are left alone:
 * VexFlow's minimum for a partial measure is not a width the notes are laid
 * out in.
 *
 * OSMD builds a fresh calculator for every sheet it loads, so this has to be
 * asked again after each `load()`; it is idempotent for one calculator.
 */

/** Marks a calculator whose width pass has been wrapped, and holds the switch */
const LYRIC_ROOM = Symbol('lyricRoom');

/** OSMD's own per-staff-entry allowance, a literal in `calculateMeasureXLayout` */
const STAFF_ENTRY_FACTOR = 0.3;

/**
 * The most a measure may be widened for its words, in place of OSMD's 2.5.
 * With the positions rescaled the honest factor for a bar of four quarter
 * notes with a word each is about 5; this is a guard against the pathological,
 * not a cap on the ordinary.
 */
export const LYRIC_ELONGATION_LIMIT = 20;

type WidthPass = MusicSheetCalculator['calculateMeasureWidthFromStaffEntries'];

interface WrappedCalculator extends MusicSheetCalculator {
    [LYRIC_ROOM]?: { enabled: boolean };
}

/** The staff entry positions a measure's width pass reads, as OSMD stores them */
function entryPositions(measures: GraphicalMeasure[]) {
    return measures
        .flatMap((measure) => measure?.staffEntries ?? [])
        .map((entry) => entry.PositionAndShape.RelativePosition);
}

/**
 * Run OSMD's width pass with the notes moved into the width it is widening.
 *
 * `tight` is OSMD's shrunken minimum for the measure; the notes were laid out
 * in VexFlow's own minimum, which this recovers from OSMD's formula. Every
 * position is scaled by the ratio of the two, the offset of the first note
 * included: that is the world the pass reasons in, where a measure of width
 * `tight` holds its notes in proportion and widening it by a factor moves
 * every note by that factor.
 */
export function widthWithLyricRoom(
    rules: Pick<EngravingRules, 'VoiceSpacingMultiplierVexflow' | 'VoiceSpacingAddendVexflow'>,
    calculator: MusicSheetCalculator,
    pass: WidthPass,
    measures: GraphicalMeasure[],
    tight: number,
): number {
    const first = measures.find((measure) => measure && measure.staffEntries.length > 1);
    if (!first || tight <= 0 || first.parentSourceMeasure.ImplicitMeasure) {
        return pass.call(calculator, measures, tight);
    }
    const vexflowMinimum =
        (tight - rules.VoiceSpacingAddendVexflow - first.staffEntries.length * STAFF_ENTRY_FACTOR) /
        rules.VoiceSpacingMultiplierVexflow;
    if (!(vexflowMinimum > tight)) return pass.call(calculator, measures, tight);

    const ratio = tight / vexflowMinimum;
    const positions = entryPositions(measures);
    const laidOut = positions.map((position) => position.x);
    positions.forEach((position, i) => {
        position.x = laidOut[i] * ratio;
    });
    try {
        return pass.call(calculator, measures, tight);
    } finally {
        positions.forEach((position, i) => {
            position.x = laidOut[i];
        });
    }
}

/**
 * Switch the lyric room on or off for the sheet OSMD currently holds.
 *
 * Call after `load()` and before every `render()`: the wrapper stays on the
 * calculator, the switch follows the page the sheet is being set on.
 */
export function reserveLyricRoom(osmd: OpenSheetMusicDisplay, enabled: boolean): void {
    const calculator = osmd.GraphicSheet?.GetCalculator as WrappedCalculator | undefined;
    if (!calculator) return;
    const wrapped = calculator[LYRIC_ROOM];
    if (wrapped) {
        wrapped.enabled = enabled;
        return;
    }
    const state = { enabled };
    calculator[LYRIC_ROOM] = state;
    // The calculator was built on these same rules; they are only reachable
    // from outside through the sheet.
    const rules = osmd.EngravingRules;
    const pass: WidthPass = calculator.calculateMeasureWidthFromStaffEntries;
    calculator.calculateMeasureWidthFromStaffEntries = function (measures, tight) {
        return state.enabled
            ? widthWithLyricRoom(rules, this, pass, measures, tight)
            : pass.call(this, measures, tight);
    };
}
