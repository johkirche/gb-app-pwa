import type {
    InstrumentPlayer,
    PlaybackInstrument,
} from 'osmd-audio-player/dist/players/InstrumentPlayer';
import type { NotePlaybackInstruction } from 'osmd-audio-player/dist/players/NotePlaybackOptions';
import * as Soundfont from 'soundfont-player';
import type { Player } from 'soundfont-player';
import type { IAudioContext } from 'standardized-audio-context';

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
 * Modeled on osmd-audio-player/dist/players/SoundfontPlayer.js with two
 * changes: `instruments` lists ONLY the vendored instruments (PlaybackEngine
 * routes every unknown score instrument through its piano fallback, so midi ID
 * 0 must always be present), and load() overrides nameToUrl to point at the
 * local files.
 */

// ArticulationStyle.Staccato from osmd-audio-player/dist/players/NotePlaybackOptions.
// Kept as a local constant so every import from the package's dist stays type-only.
const ARTICULATION_STACCATO = 1;

export class LocalSoundfontPlayer implements InstrumentPlayer {
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
        this.players.get(midiId)?.play(String(options.note), 0, {
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
        this.players.get(midiId)?.schedule(time, notes);
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
