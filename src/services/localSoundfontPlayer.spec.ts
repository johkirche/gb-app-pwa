import type { NotePlaybackInstruction } from 'osmd-audio-player/dist/players/NotePlaybackOptions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OSMD_HALFTONE_TO_MIDI } from '@/services/instrumentPlayer';
import { LocalSoundfontPlayer } from '@/services/localSoundfontPlayer';

// Ein geschriebenes a' — laut OSMD selbst 440 Hz — kommt als Halbton 57 aus dem
// Satz. Die Klangbibliothek ist nach MIDI-Nummern sortiert, dort heißt dieselbe
// Note 69. Ohne die Verschiebung klingt jedes Lied eine Oktave zu tief.
const A_PRIME_HALFTONE = 57;
const A_PRIME_MIDI = 69;

const CHURCH_ORGAN = 19;

function note(partial: Partial<NotePlaybackInstruction> = {}): NotePlaybackInstruction {
    return {
        note: A_PRIME_HALFTONE,
        duration: 1,
        gain: 0.8,
        articulation: 0,
        ...partial,
    } as NotePlaybackInstruction;
}

let player: LocalSoundfontPlayer;
let sampler: {
    play: ReturnType<typeof vi.fn>;
    schedule: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
    player = new LocalSoundfontPlayer();
    // stop() is what muting reaches for: notes already handed to the audio
    // graph run ahead of what is heard and have to be cut off.
    sampler = { play: vi.fn(), schedule: vi.fn(), stop: vi.fn() };
    // load() would fetch a soundfont over the network; the sampler it produces
    // is all this cares about, so it is put in place directly.
    (player as unknown as { players: Map<number, unknown> }).players.set(CHURCH_ORGAN, sampler);
});

describe('LocalSoundfontPlayer – Oktavlage', () => {
    it('spielt die Note in der Oktave, in der sie steht', () => {
        player.schedule(CHURCH_ORGAN, 0, [note()]);

        const [, scheduled] = sampler.schedule.mock.calls[0];
        expect(scheduled[0].note).toBe(A_PRIME_MIDI);
    });

    it('verschiebt auch die einzeln angeschlagene Note', () => {
        player.play(CHURCH_ORGAN, note());

        expect(sampler.play).toHaveBeenCalledWith(String(A_PRIME_MIDI), 0, expect.anything());
    });

    it('lässt die Notenliste der Engine unangetastet', () => {
        // Über dieselbe Liste meldet die Engine ihr ITERATION-Ereignis, aus dem
        // die Seite den Cursor setzt — eine Verschiebung darin würde die
        // Markierung auf der Seite verrücken.
        const notes = [note()];
        player.schedule(CHURCH_ORGAN, 0, notes);

        expect(notes[0].note).toBe(A_PRIME_HALFTONE);
    });

    it('schweigt stumm geschaltet', () => {
        player.setMuted(true);
        player.schedule(CHURCH_ORGAN, 0, [note()]);
        player.play(CHURCH_ORGAN, note());

        expect(sampler.schedule).not.toHaveBeenCalled();
        expect(sampler.play).not.toHaveBeenCalled();
        expect(sampler.stop).toHaveBeenCalled();
    });

    it('verschiebt um genau eine Oktave', () => {
        expect(OSMD_HALFTONE_TO_MIDI).toBe(12);
    });
});
