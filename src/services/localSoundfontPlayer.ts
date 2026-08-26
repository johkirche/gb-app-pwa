import type { PlaybackInstrument } from 'osmd-audio-player/dist/players/InstrumentPlayer';
import type { NotePlaybackInstruction } from 'osmd-audio-player/dist/players/NotePlaybackOptions';
import * as Soundfont from 'soundfont-player';
import type { Player } from 'soundfont-player';
import type { IAudioContext } from 'standardized-audio-context';

import {
    ARTICULATION_STACCATO,
    type HymnInstrumentPlayer,
    OSMD_HALFTONE_TO_MIDI,
} from '@/services/instrumentPlayer';

/**
 * Local Soundfont Player
 *
 * Drop-in replacement for osmd-audio-player's bundled SoundfontPlayer that
 * loads soundfonts from the app's own origin (public/soundfonts/) instead of
 * gleitz.github.io. The vendored files keep soundfont-player's canonical
 * `<name>-mp3.js` naming so its loader parses them unchanged, and the
 * precached app shell makes playback work fully offline with no third-party
 * request ever firing.
 *
 * Modeled on osmd-audio-player/dist/players/SoundfontPlayer.js with three
 * changes: `instruments` lists ONLY the vendored instruments (PlaybackEngine
 * routes every unknown score instrument through its piano fallback, so midi ID
 * 0 must always be present), load() overrides nameToUrl to point at the local
 * files, and every note is shifted by OSMD_HALFTONE_TO_MIDI — the engine hands
 * over OSMD half-tones, which are an octave below the MIDI numbers this
 * soundfont is keyed by.
 */

export class LocalSoundfontPlayer implements HymnInstrumentPlayer {
    public instruments: PlaybackInstrument[] = [
        { midiId: 0, name: 'Acoustic Grand Piano', loaded: false },
        { midiId: 19, name: 'Church Organ', loaded: false },
    ];

    private players: Map<number, Player> = new Map();
    private audioContext: IAudioContext | null = null;
    private muted = false;

    public init(audioContext: IAudioContext): void {
        this.audioContext = audioContext;
    }

    /**
     * Silence the instruments without stopping the playback.
     *
     * The engine keeps its own clock and keeps walking the cursor either way,
     * so muting here — rather than pausing — is what lets the page follow the
     * song on screen with nothing to hear. Notes already handed to the audio
     * graph are up to half a second ahead of what is heard, so they are cut
     * off too; otherwise muting would keep sounding after the tap.
     */
    public setMuted(muted: boolean): void {
        this.muted = muted;
        if (!muted) return;
        for (const midiId of this.players.keys()) this.stop(midiId);
    }

    /**
     * What the machine adds between the graph and the speaker.
     *
     * Two segments, and they add up: `baseLatency` is the context's own
     * buffering, `outputLatency` the buffer between the audio subsystem and
     * the hardware — the larger of the two, and much larger again over
     * Bluetooth. standardized-audio-context forwards the first and not the
     * second, so the native context underneath is asked for it; where that is
     * out of reach, or the browser has no such reading (Safari, Firefox), the
     * correction is the smaller half rather than nothing at all.
     */
    public outputLatency(): number {
        const context = this.audioContext as
            | (IAudioContext & { _nativeAudioContext?: { outputLatency?: number } })
            | null;
        if (!context) return 0;
        const base = typeof context.baseLatency === 'number' ? context.baseLatency : 0;
        const output = context._nativeAudioContext?.outputLatency;
        const total = base + (typeof output === 'number' ? output : 0);
        // A reading this far out is not a latency, it is a bad number — and
        // holding the mark back by it would be worse than the lead it fixes.
        return total > 0 && total < 0.5 ? total : Math.min(Math.max(base, 0), 0.5);
    }

    public async load(midiId: number): Promise<void> {
        const instrument = this.instruments.find((i) => i.midiId === midiId);
        if (!instrument) {
            throw new Error(`LocalSoundfontPlayer does not support midi instrument ID ${midiId}`);
        }
        if (this.players.has(midiId)) return;

        // 'Acoustic Grand Piano' -> 'acoustic_grand_piano' (soundfont-player convention)
        const name = instrument.name.toLowerCase().replace(/\s+/g, '_');
        const player = await Soundfont.instrument(
            // standardized-audio-context implements the same surface soundfont-player uses
            this.audioContext as unknown as AudioContext,
            name as Parameters<typeof Soundfont.instrument>[1],
            {
                // Same-origin URL — never hits gleitz.github.io
                nameToUrl: (n: string) => `${import.meta.env.BASE_URL}soundfonts/${n}-mp3.js`,
            },
        );
        this.players.set(midiId, player);
        instrument.loaded = true;
    }

    public play(midiId: number, options: NotePlaybackInstruction): void {
        if (this.muted) return;
        this.verifyPlayerLoaded(midiId);
        this.players.get(midiId)?.play(String(options.note + OSMD_HALFTONE_TO_MIDI), 0, {
            gain: options.gain,
            duration: options.duration,
        });
    }

    public stop(midiId: number): void {
        if (!this.players.has(midiId)) return;
        this.players.get(midiId)?.stop();
    }

    public schedule(midiId: number, time: number, notes: NotePlaybackInstruction[]): void {
        if (this.muted) return;
        this.verifyPlayerLoaded(midiId);
        this.applyDynamics(notes);
        // A copy, not a shift in place: the engine emits the ITERATION event
        // over this same array, and the page reads the notes back from it.
        const pitched = notes.map((note) => ({
            ...note,
            note: note.note + OSMD_HALFTONE_TO_MIDI,
        }));
        this.players.get(midiId)?.schedule(time, pitched);
    }

    private applyDynamics(notes: NotePlaybackInstruction[]): void {
        for (const note of notes) {
            if (note.articulation === ARTICULATION_STACCATO) {
                note.gain = Math.max(note.gain + 0.3, note.gain * 1.3);
                note.duration = Math.min(note.duration * 0.4, 0.4);
            }
        }
    }

    private verifyPlayerLoaded(midiId: number): void {
        if (!this.players.has(midiId)) {
            throw new Error(`No soundfont player loaded for midi instrument ${midiId}`);
        }
    }
}
