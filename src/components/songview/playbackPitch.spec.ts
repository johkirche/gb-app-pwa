import { describe, expect, it } from 'vitest';

import {
    PITCH_MAX,
    PITCH_MIN,
    PITCH_NONE,
    type SongKey,
    clampPitch,
    germanKeyName,
    pitchHint,
    pitchLabel,
    soundingKeyName,
    stepPitch,
    transposeKey,
} from './playbackPitch';

const C_DUR: SongKey = { fifths: 0, minor: false };
const F_DUR: SongKey = { fifths: -1, minor: false };
const ES_DUR: SongKey = { fifths: -3, minor: false };
const A_MOLL: SongKey = { fifths: 0, minor: true };

describe('clampPitch', () => {
    it('keeps the offset inside the octave either side', () => {
        expect(clampPitch(-20)).toBe(PITCH_MIN);
        expect(clampPitch(20)).toBe(PITCH_MAX);
        expect(clampPitch(-2)).toBe(-2);
    });

    it('answers the printed key for an offset that is no number', () => {
        expect(clampPitch(Number.NaN)).toBe(PITCH_NONE);
        expect(clampPitch(Number.POSITIVE_INFINITY)).toBe(PITCH_NONE);
    });
});

describe('stepPitch', () => {
    it('moves one half-tone at a time', () => {
        expect(stepPitch(0, 1)).toBe(1);
        expect(stepPitch(0, -1)).toBe(-1);
    });

    it('stops at the ends rather than running past them', () => {
        expect(stepPitch(PITCH_MAX, 1)).toBe(PITCH_MAX);
        expect(stepPitch(PITCH_MIN, -1)).toBe(PITCH_MIN);
    });
});

describe('transposeKey', () => {
    it('moves a key by the half-tones asked for', () => {
        // F-Dur two half-tones up is G-Dur: one flat becomes one sharp.
        expect(germanKeyName(transposeKey(F_DUR, 2))).toBe('G-Dur');
        expect(germanKeyName(transposeKey(C_DUR, -1))).toBe('H-Dur');
        expect(germanKeyName(transposeKey(ES_DUR, -3))).toBe('C-Dur');
    });

    it('keeps a minor key minor, and names its own tonic', () => {
        expect(germanKeyName(transposeKey(A_MOLL, 3))).toBe('c-Moll');
        expect(germanKeyName(transposeKey(A_MOLL, -2))).toBe('g-Moll');
    });

    it('comes back to where it started after an octave', () => {
        expect(transposeKey(F_DUR, 12)).toEqual(F_DUR);
        expect(transposeKey(A_MOLL, -12)).toEqual(A_MOLL);
    });

    // Six steps out, the two spellings are the same sound. A hymnal writes the
    // flat one, so the fold lands there rather than on Fis-Dur and dis-Moll.
    it('spells the far side of the circle with flats', () => {
        expect(germanKeyName(transposeKey(C_DUR, 6))).toBe('Ges-Dur');
        expect(germanKeyName(transposeKey(A_MOLL, 6))).toBe('es-Moll');
    });

    it('stays inside the signatures anyone writes', () => {
        for (let semitones = PITCH_MIN; semitones <= PITCH_MAX; semitones++) {
            for (const key of [C_DUR, F_DUR, ES_DUR, A_MOLL]) {
                const moved = transposeKey(key, semitones);
                expect(moved.fifths).toBeGreaterThanOrEqual(-6);
                expect(moved.fifths).toBeLessThanOrEqual(5);
                expect(germanKeyName(moved)).not.toBeNull();
            }
        }
    });
});

describe('germanKeyName', () => {
    it('names the signature in the spelling a German hymnal uses', () => {
        expect(germanKeyName({ fifths: -2, minor: false })).toBe('B-Dur');
        expect(germanKeyName({ fifths: 2, minor: false })).toBe('D-Dur');
        expect(germanKeyName({ fifths: -1, minor: true })).toBe('d-Moll');
    });

    it('names nothing for a signature nobody writes', () => {
        expect(germanKeyName({ fifths: 9, minor: false })).toBeNull();
    });
});

describe('soundingKeyName', () => {
    it('says what the hymn sounds in at this offset', () => {
        expect(soundingKeyName(F_DUR, 0)).toBe('F-Dur');
        expect(soundingKeyName(F_DUR, -2)).toBe('Es-Dur');
    });

    // A modal or unmarked sheet names no key, and neither does the control:
    // it counts half-tones instead, which says less but is never wrong.
    it('names nothing where the sheet named no key', () => {
        expect(soundingKeyName(null, 2)).toBeNull();
    });
});

describe('pitchLabel and pitchHint', () => {
    it('reads as the printed hymn while it rests', () => {
        expect(pitchLabel(0)).toBe('Original');
        expect(pitchHint(0)).toBe('Wie notiert');
    });

    it('says which way the music was moved, and by how much', () => {
        expect(pitchLabel(2)).toBe('+2');
        expect(pitchLabel(-3)).toBe('−3');
        expect(pitchHint(1)).toBe('1 Halbton höher');
        expect(pitchHint(2)).toBe('2 Halbtöne höher');
        expect(pitchHint(-3)).toBe('3 Halbtöne tiefer');
    });
});
