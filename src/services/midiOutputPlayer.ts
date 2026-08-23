import type { PlaybackInstrument } from 'osmd-audio-player/dist/players/InstrumentPlayer';
import type { NotePlaybackInstruction } from 'osmd-audio-player/dist/players/NotePlaybackOptions';
import type { IAudioContext } from 'standardized-audio-context';

import {
    ARTICULATION_STACCATO,
    type HymnInstrumentPlayer,
    OSMD_HALFTONE_TO_MIDI,
} from '@/services/instrumentPlayer';

/**
 * Sends the score to a connected MIDI instrument instead of sounding it here.
 *
 * A drop-in sibling of `LocalSoundfontPlayer`: the playback engine keeps its
 * clock, its cursor and its scheduling, and only the notes leave the browser.
 * The engine hands over an AudioContext timestamp for each batch; Web MIDI
 * takes a `performance.now()` timestamp, and both are millisecond clocks on the
 * same monotonic base, so the conversion is a subtraction. Handing the device a
 * future timestamp is better than a `setTimeout` per note: the instrument's own
 * queue holds the events and plays them without our jitter.
 *
 * What it deliberately does NOT do is send a Program Change. The registration
 * on an organ is the organist's, not ours; overriding it from a hymnal app
 * would be rude and surprising. `load()` therefore only claims a channel.
 */

const ALL_SOUND_OFF = 120;
const ALL_NOTES_OFF = 123;
/** Note-offs are never scheduled tighter than this, so nothing is swallowed. */
const MIN_NOTE_MS = 30;

function clamp(value: number, low: number, high: number): number {
    return Math.max(low, Math.min(high, Math.round(value)));
}

export class MidiOutputPlayer implements HymnInstrumentPlayer {
    // The same two the soundfont offers. The engine routes every score
    // instrument it does not recognise through midi ID 0, so 0 must be present.
    public instruments: PlaybackInstrument[] = [
        { midiId: 0, name: 'Acoustic Grand Piano', loaded: false },
        { midiId: 19, name: 'Church Organ', loaded: false },
    ];

    private audioContext: IAudioContext | null = null;
    private muted = false;
    private readonly channels = new Map<number, number>();
    /** Channels that have sounded, and therefore have to be silenced. */
    private readonly usedChannels = new Set<number>();

    constructor(private readonly output: MIDIOutput) {}

    public init(audioContext: IAudioContext): void {
        this.audioContext = audioContext;
    }

    public async load(midiId: number): Promise<void> {
        this.channelFor(midiId);
        const instrument = this.instruments.find((i) => i.midiId === midiId);
        if (instrument) instrument.loaded = true;
    }

    public setMuted(muted: boolean): void {
        this.muted = muted;
        // Notes are already sitting in the device's queue with future
        // timestamps, so muting has to reach in and clear them — otherwise the
        // organ plays on for a bar after the tap.
        if (muted) this.panic();
    }

    public schedule(midiId: number, time: number, notes: NotePlaybackInstruction[]): void {
        if (this.muted) return;
        const channel = this.channelFor(midiId);
        // Recomputed per batch rather than cached: an offset taken once would
        // drift against the audio clock over a long hymn.
        const context = this.audioContext;
        const aheadMs = context ? Math.max(0, (time - context.currentTime) * 1000) : 0;
        const startAt = performance.now() + aheadMs;

        for (const note of notes) {
            const key = Math.round(note.note) + OSMD_HALFTONE_TO_MIDI;
            if (key < 0 || key > 127) continue;

            let seconds = note.duration;
            let gain = note.gain;
            if (note.articulation === ARTICULATION_STACCATO) {
                gain = Math.max(gain + 0.3, gain * 1.3);
                seconds = Math.min(seconds * 0.4, 0.4);
            }

            const velocity = clamp(gain * 127, 1, 127);
            const endAt = startAt + Math.max(MIN_NOTE_MS, seconds * 1000);
            this.send([0x90 | channel, key, velocity], startAt);
            this.send([0x80 | channel, key, 0], endAt);
            this.usedChannels.add(channel);
        }
    }

    /** Sound one note now — the engine's non-scheduled path. */
    public play(midiId: number, options: NotePlaybackInstruction): void {
        if (this.muted) return;
        this.schedule(midiId, this.audioContext?.currentTime ?? 0, [options]);
    }

    public stop(midiId: number): void {
        this.silence(this.channelFor(midiId));
    }

    public dispose(): void {
        this.panic();
    }

    private channelFor(midiId: number): number {
        const existing = this.channels.get(midiId);
        if (existing !== undefined) return existing;
        // Channel 10 (index 9) is percussion by GM convention — never a hymn.
        let channel = this.channels.size;
        if (channel >= 9) channel += 1;
        if (channel > 15) channel = 15;
        this.channels.set(midiId, channel);
        return channel;
    }

    /** Drop everything queued and silence every channel that has sounded. */
    private panic(): void {
        try {
            // Clearing also drops the note-offs already queued, which is why
            // every channel is silenced explicitly right after. Spec'd but not
            // in every engine (nor in lib.dom), hence the guarded call.
            (this.output as MIDIOutput & { clear?: () => void }).clear?.();
        } catch {
            // Not implemented here; the channel messages below suffice.
        }
        for (const channel of this.usedChannels) this.silence(channel);
        this.usedChannels.clear();
    }

    private silence(channel: number): void {
        this.send([0xb0 | channel, ALL_SOUND_OFF, 0]);
        this.send([0xb0 | channel, ALL_NOTES_OFF, 0]);
    }

    private send(bytes: number[], at?: number): void {
        try {
            this.output.send(bytes, at);
        } catch (error) {
            // A keyboard unplugged mid-hymn throws here. The page carries on
            // showing the score; the notes simply have nowhere to go.
            console.error('MIDI send failed:', error);
        }
    }
}
