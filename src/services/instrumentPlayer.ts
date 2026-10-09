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

/** ArticulationStyle.Staccato — kept local so the package import stays type-only. */
export const ARTICULATION_STACCATO = 1;

/**
 * The MIDI note the engine's note is to sound as, moved by the reader's
 * offset — or null, where the offset has carried it off the keyboard.
 *
 * What arrives is already a MIDI number. OSMD counts half-tones an octave below
 * MIDI — a written a′, MIDI 69, is half-tone 57 — but `osmd-audio-player`
 * converts on the way out: `PlaybackEngine.notePlaybackCallback` schedules
 * `note.halfTone - fixedKey * 12`, and OSMD's `SubInstrument.fixedKey` is −1
 * unless the sheet carries a `<midi-unpitched>`, which no hymn does. So the a′
 * arrives as 69, and adding the octave here as well put every hymn an octave
 * above the page (osmdAudioPlayerPatch.spec pins the engine's half of this).
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
export function midiKeyFor(midiNote: number, semitones = 0): number | null {
    const key = Math.round(midiNote) + semitones;
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
