import type { InstrumentPlayer } from 'osmd-audio-player/dist/players/InstrumentPlayer';

import { activeMidiOutput } from '@/composables/useMidiOutput';

/**
 * Where a hymn's notes go: the built-in soundfont, or a connected instrument.
 *
 * Both sinks implement `osmd-audio-player`'s `InstrumentPlayer`, which is the
 * whole trick behind MIDI output — the engine goes on walking the score,
 * moving the cursor and the playhead and honouring tempo and seeking, and only
 * the last step, where a note becomes sound, changes. Nothing above this line
 * knows which one is in use.
 */
export interface HymnInstrumentPlayer extends InstrumentPlayer {
    /** Follow the song on screen with nothing to hear. */
    setMuted(muted: boolean): void;
    /**
     * Play the hymn this many half-tones from where it is printed.
     *
     * It belongs to the sink and to nothing above it: the engine goes on
     * walking the score as written, the cursor stands on the note the book
     * prints, and only the number handed to the instrument moves. That is what
     * makes it a playback offset rather than a transposition — the engraving
     * on the page is never touched. See `playbackPitch` for the control.
     */
    setTranspose(semitones: number): void;
    /**
     * How long after the moment it was scheduled for this sink's sound is
     * actually heard, in seconds.
     *
     * The engine announces a note when it hands it over, not when it comes out
     * of anything, so this is what the page has to wait before moving the mark
     * — otherwise the band and the line run ahead of the music by however long
     * the sound takes to get out. Only the sink knows: the soundfont goes
     * through the audio graph and the machine's output buffer, a connected
     * instrument does not.
     */
    outputLatency?(): number;
    /** Release the sink. A MIDI instrument must be silenced, or it holds. */
    dispose?(): void;
}

/**
 * What must be added to an OSMD half-tone to get a MIDI note number.
 *
 * OSMD counts half-tones on its own scale, offset by an octave from MIDI: a
 * written a′ — MIDI 69, and 440 Hz by OSMD's own `Pitch.Frequency` — comes out
 * of the score as half-tone 57. `osmd-audio-player` passes that number straight
 * through to the instrument player as if it were MIDI (see
 * `PlaybackEngine.notePlaybackCallback`, which schedules `note.halfTone`), and
 * soundfont-player keys its samples by MIDI number. Uncorrected, every hymn
 * therefore sounds an octave below the page.
 *
 * Both sinks apply this, so the soundfont and a connected instrument agree.
 * Set it to 0 to get the old, octave-low behaviour back.
 */
export const OSMD_HALFTONE_TO_MIDI = 12;

/** ArticulationStyle.Staccato — kept local so the package import stays type-only. */
export const ARTICULATION_STACCATO = 1;

/**
 * The MIDI note a written half-tone is to sound as — or null, where the offset
 * has carried it off the keyboard.
 *
 * Both sinks go through this, so a hymn played an octave down sounds the same
 * whether it goes to the soundfont or to an organ, and so the one place that
 * knows a note number is bounded is the one place that checks. Dropped rather
 * than clamped: a note folded back into range would sound in the wrong octave,
 * which is a wrong note played confidently, while a dropped one is a gap the
 * ear reads as the end of the register. Neither happens within the octave the
 * transport offers — hymn melodies sit in the middle of the keyboard — but the
 * engine also sounds whatever else a sheet carries.
 */
export function midiKeyFor(halfTone: number, semitones = 0): number | null {
    const key = Math.round(halfTone) + OSMD_HALFTONE_TO_MIDI + semitones;
    return key >= 0 && key <= 127 ? key : null;
}

/** An offset a sink can safely add to every note: whole half-tones, never NaN. */
export function sanitizeTranspose(semitones: number): number {
    return Number.isFinite(semitones) ? Math.round(semitones) : 0;
}

/**
 * Build the sink for the current output. Both branches are imported lazily:
 * the soundfont is multiple seconds of download that a reader playing to a
 * keyboard should never pay for, and vice versa.
 */
export async function createInstrumentPlayer(): Promise<HymnInstrumentPlayer> {
    const output = activeMidiOutput();
    if (output) {
        const { MidiOutputPlayer } = await import('@/services/midiOutputPlayer');
        return new MidiOutputPlayer(output);
    }
    const { LocalSoundfontPlayer } = await import('@/services/localSoundfontPlayer');
    return new LocalSoundfontPlayer();
}
