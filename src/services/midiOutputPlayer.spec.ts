import type { NotePlaybackInstruction } from 'osmd-audio-player/dist/players/NotePlaybackOptions';
import type { IAudioContext } from 'standardized-audio-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OSMD_HALFTONE_TO_MIDI } from '@/services/instrumentPlayer';
import { MidiOutputPlayer } from '@/services/midiOutputPlayer';

const CHURCH_ORGAN = 19;

// Ein a' steht im Satz als OSMD-Halbton 57 — die Engine reicht genau diese Zahl
// durch. Auf dem Instrument muss daraus MIDI 69 werden.
const A_PRIME_HALFTONE = 57;
const A_PRIME_MIDI = 69;

function note(partial: Partial<NotePlaybackInstruction> = {}): NotePlaybackInstruction {
    return {
        note: A_PRIME_HALFTONE,
        duration: 1,
        gain: 0.8,
        articulation: 0,
        ...partial,
    } as NotePlaybackInstruction;
}

function makeOutput() {
    return {
        id: 'out-1',
        send: vi.fn(),
        clear: vi.fn(),
    };
}

let output: ReturnType<typeof makeOutput>;
let player: MidiOutputPlayer;
// Plain object rather than a cast IAudioContext: the test moves the clock on,
// and the real interface declares currentTime readonly.
const context = { currentTime: 0 };

beforeEach(() => {
    output = makeOutput();
    context.currentTime = 0;
    player = new MidiOutputPlayer(output as unknown as MIDIOutput);
    player.init(context as unknown as IAudioContext);
});

/** Alle gesendeten Statusbytes eines Typs, z. B. 0x90 = Note On. */
function sent(statusNibble: number) {
    return output.send.mock.calls.filter(([bytes]) => (bytes[0] & 0xf0) === statusNibble);
}

describe('MidiOutputPlayer', () => {
    it('hebt den OSMD-Halbton auf die MIDI-Notennummer', () => {
        player.schedule(CHURCH_ORGAN, 0, [note()]);

        const [noteOn] = sent(0x90);
        expect(noteOn[0][1]).toBe(A_PRIME_MIDI);
        expect(OSMD_HALFTONE_TO_MIDI).toBe(A_PRIME_MIDI - A_PRIME_HALFTONE);
    });

    it('schickt zu jedem Note On ein Note Off am Ende der Note', () => {
        const before = performance.now();
        // Die Engine plant eine halbe Sekunde voraus.
        context.currentTime = 10;
        player.schedule(CHURCH_ORGAN, 10.5, [note({ duration: 1 })]);

        const [[onBytes, onAt]] = sent(0x90);
        const [[offBytes, offAt]] = sent(0x80);

        expect(onBytes[1]).toBe(A_PRIME_MIDI);
        expect(offBytes[1]).toBe(A_PRIME_MIDI);
        // Der Vorlauf der Engine landet als Zeitstempel beim Gerät …
        expect(onAt).toBeGreaterThanOrEqual(before + 500);
        // … und die Note endet eine Sekunde später.
        expect(offAt - onAt).toBeCloseTo(1000, 5);
    });

    it('kürzt Staccato-Noten und hebt ihre Anschlagstärke', () => {
        player.schedule(CHURCH_ORGAN, 0, [note({ duration: 1, gain: 0.5, articulation: 1 })]);

        const [[onBytes, onAt]] = sent(0x90);
        const [[, offAt]] = sent(0x80);
        expect(offAt - onAt).toBeCloseTo(400, 5);
        expect(onBytes[2]).toBeGreaterThan(Math.round(0.5 * 127));
    });

    it('lässt Noten außerhalb des MIDI-Bereichs fallen, statt sie umzuklappen', () => {
        player.schedule(CHURCH_ORGAN, 0, [note({ note: 200 }), note({ note: -50 }), note()]);

        expect(sent(0x90)).toHaveLength(1);
        expect(sent(0x90)[0][0][1]).toBe(A_PRIME_MIDI);
    });

    it('schweigt stumm geschaltet und räumt dabei die Warteschlange des Geräts', () => {
        player.schedule(CHURCH_ORGAN, 0, [note()]);
        output.send.mockClear();

        player.setMuted(true);
        // Was schon im Gerät liegt, muss zurückgenommen werden …
        expect(output.clear).toHaveBeenCalled();
        // … und alles Klingende verstummen (CC 120 / CC 123).
        const controls = sent(0xb0).map(([bytes]) => bytes[1]);
        expect(controls).toContain(120);
        expect(controls).toContain(123);

        output.send.mockClear();
        player.schedule(CHURCH_ORGAN, 0, [note()]);
        expect(sent(0x90)).toHaveLength(0);
    });

    it('lässt beim Aufräumen keine hängende Note zurück', () => {
        player.schedule(CHURCH_ORGAN, 0, [note()]);
        output.send.mockClear();

        player.dispose();

        const controls = sent(0xb0).map(([bytes]) => bytes[1]);
        expect(controls).toContain(120);
        expect(controls).toContain(123);
    });

    it('gibt jedem Instrument einen eigenen Kanal und lässt Kanal 10 aus', async () => {
        // Kanal 10 (Index 9) ist im General-MIDI-Standard das Schlagzeug.
        for (let i = 0; i < 10; i++) await player.load(i);
        player.schedule(0, 0, [note()]);
        player.schedule(9, 0, [note()]);

        const channels = sent(0x90).map(([bytes]) => bytes[0] & 0x0f);
        expect(channels).toContain(0);
        expect(channels).toContain(10);
        expect(channels).not.toContain(9);
    });

    it('schickt keinen Program Change — die Registrierung gehört dem Instrument', async () => {
        await player.load(CHURCH_ORGAN);
        player.schedule(CHURCH_ORGAN, 0, [note()]);

        expect(sent(0xc0)).toHaveLength(0);
    });

    it('überlebt ein mitten im Lied abgezogenes Kabel', () => {
        output.send.mockImplementation(() => {
            throw new DOMException('device gone', 'InvalidStateError');
        });

        expect(() => player.schedule(CHURCH_ORGAN, 0, [note()])).not.toThrow();
    });
});

describe('MidiOutputPlayer – wie lange der Klang braucht', () => {
    it('lässt das Laufband nicht warten', () => {
        // schedule() rechnet den Moment der Audio-Uhr selbst in die Wanduhr um
        // und schickt die Note von Hand los — dieser Ausgang sitzt also nie
        // hinter dem Ausgabepuffer des Klanggraphen.
        expect(new MidiOutputPlayer({ send: () => {} } as never).outputLatency()).toBe(0);
    });
});
