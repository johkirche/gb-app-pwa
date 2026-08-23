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
