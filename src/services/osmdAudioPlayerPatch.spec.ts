import PlaybackEngine from 'osmd-audio-player';
import { PlaybackEvent } from 'osmd-audio-player/dist/PlaybackEngine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The engine is patched — see patches/osmd-audio-player@0.7.0.patch — so
// that a jump lands on the step it was asked for: unpatched, it pointed the
// scheduler one step past the target and skipped the note the reader tapped.
// The patch also has the scheduler look for due notes the moment it starts
// rather than at the first tick of its interval, and stops it leaking that
// interval on every stop. This is the contract the page relies on, pinned
// down against a four-note sheet made of the bare objects the engine reads.

const QUARTER = 0.25;
/** Halftone of the first note; each step is one higher, so a note names its step. */
const FIRST_HALFTONE = 60;

function buildSheet() {
    const voice: Record<string, unknown> = { VoiceId: 1, Volume: 1 };
    const instrument = {
        MidiInstrumentId: 0,
        Voices: [voice],
        SubInstruments: [{ fixedKey: 0 }],
    };
    voice.Parent = instrument;
    const entries = Array.from({ length: 4 }, (_, i) => {
        const entry: Record<string, unknown> = { IsGrace: false, isStaccato: () => false };
        entry.ParentVoice = voice;
        entry.Notes = [
            {
                halfTone: FIRST_HALFTONE + i,
                Length: { RealValue: QUARTER },
                NoteTie: null,
                isRest: () => false,
                ParentVoiceEntry: entry,
            },
        ];
        return entry;
    });
    let position = 0;
    const cursor = {
        get position() {
            return position;
        },
        Iterator: {
            get EndReached() {
                return position >= entries.length;
            },
            get CurrentVoiceEntries() {
                return position < entries.length ? [entries[position]] : [];
            },
        },
        next: () => {
            position++;
        },
        reset: () => {
            position = 0;
        },
        show: () => {},
        hide: () => {},
    };
    return { Sheet: { Instruments: [instrument], HasBPMInfo: false }, cursor };
}

function buildEngine() {
    const context = { currentTime: 0, resume: vi.fn(async () => {}), suspend: vi.fn() };
    const schedule = vi.fn();
    const player = {
        instruments: [{ midiId: 0, name: 'piano' }],
        init: () => {},
        load: async () => {},
        schedule,
        stop: () => {},
    };
    const engine = new PlaybackEngine(context as never, player as never);
    const osmd = buildSheet();
    return { engine, osmd, context, schedule };
}

/** The steps whose notes a schedule call carried, by the note's halftone */
function scheduledSteps(schedule: ReturnType<typeof vi.fn>): number[] {
    return schedule.mock.calls.map(
        ([, , notes]) => (notes as { note: number }[])[0].note - FIRST_HALFTONE,
    );
}

describe('the patched osmd-audio-player engine', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sounds the step jumped to first, at once', async () => {
        const { engine, osmd, schedule } = buildEngine();
        await engine.loadScore(osmd as never);

        engine.jumpToStep(2);
        await engine.play();

        expect(scheduledSteps(schedule)).toEqual([2]);
        expect(schedule.mock.calls[0][1]).toBe(0);
    });

    it('has the cursor on the step as it sounds', async () => {
        const { engine, osmd } = buildEngine();
        await engine.loadScore(osmd as never);
        const announced: number[] = [];
        engine.on(PlaybackEvent.ITERATION, () => announced.push(osmd.cursor.position));

        engine.jumpToStep(2);
        await engine.play();
        vi.advanceTimersByTime(1);

        expect(announced).toEqual([2]);
    });

    it('lands a jump made while playing', async () => {
        const { engine, osmd, context, schedule } = buildEngine();
        await engine.loadScore(osmd as never);
        const announced: number[] = [];
        engine.on(PlaybackEvent.ITERATION, () => announced.push(osmd.cursor.position));

        // Play from the top for a while: at 100 bpm a second of audio time
        // reaches past the run-in and the first note, into the second — which
        // the scheduler picks up on its next tick and sounds a beat later.
        await engine.play();
        context.currentTime = 1;
        vi.advanceTimersByTime(600);
        expect(announced).toEqual([0, 1]);
        schedule.mockClear();

        engine.jumpToStep(1);
        await engine.play();
        vi.advanceTimersByTime(1);

        expect(scheduledSteps(schedule)).toEqual([1]);
        expect(announced).toEqual([0, 1, 1]);
    });

    it('keeps the first note from being jumped over as well', async () => {
        const { engine, osmd, schedule } = buildEngine();
        await engine.loadScore(osmd as never);

        engine.jumpToStep(0);
        await engine.play();

        expect(scheduledSteps(schedule)).toEqual([0]);
    });

    // OSMD counts half-tones an octave below MIDI, and the engine converts on
    // the way out through `fixedKey`, which OSMD leaves at −1 on every sheet
    // without a <midi-unpitched> — every hymn. So what reaches the instrument
    // player is already MIDI, and the sinks must not add the octave again.
    it('hands the instrument player MIDI numbers, not OSMD half-tones', async () => {
        const A_PRIME_HALFTONE = 57;
        const A_PRIME_MIDI = 69;
        const { engine, osmd, schedule } = buildEngine();
        const [instrument] = osmd.Sheet.Instruments;
        instrument.SubInstruments = [{ fixedKey: -1 }];
        const [first] = (
            osmd.cursor.Iterator.CurrentVoiceEntries[0] as { Notes: { halfTone: number }[] }
        ).Notes;
        first.halfTone = A_PRIME_HALFTONE;
        await engine.loadScore(osmd as never);

        engine.jumpToStep(0);
        await engine.play();

        expect(schedule.mock.calls[0][2][0].note).toBe(A_PRIME_MIDI);
    });

    it('leaves no timer behind once stopped', async () => {
        const { engine, osmd } = buildEngine();
        await engine.loadScore(osmd as never);

        await engine.play();
        await engine.stop();

        expect(vi.getTimerCount()).toBe(0);
    });
});
