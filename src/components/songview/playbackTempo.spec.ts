import { describe, expect, it } from 'vitest';

import {
    TEMPO_DEFAULT,
    TEMPO_MAX,
    TEMPO_MIN,
    TEMPO_PRESETS,
    clampTempo,
    presetForTempo,
    stepTempo,
} from './playbackTempo';

describe('clampTempo', () => {
    it('keeps a tempo inside what the transport goes to', () => {
        expect(clampTempo(40)).toBe(TEMPO_MIN);
        expect(clampTempo(240)).toBe(TEMPO_MAX);
        expect(clampTempo(104)).toBe(104);
    });

    it('answers the default for a tempo that is no number', () => {
        expect(clampTempo(Number.NaN)).toBe(TEMPO_DEFAULT);
        expect(clampTempo(Number.POSITIVE_INFINITY)).toBe(TEMPO_DEFAULT);
    });
});

describe('stepTempo', () => {
    it('moves one step at a time', () => {
        expect(stepTempo(120, 1)).toBe(125);
        expect(stepTempo(120, -1)).toBe(115);
    });

    it('stops at the ends rather than running past them', () => {
        expect(stepTempo(TEMPO_MAX, 1)).toBe(TEMPO_MAX);
        expect(stepTempo(TEMPO_MIN, -1)).toBe(TEMPO_MIN);
    });
});

describe('presetForTempo', () => {
    it('names the preset a tempo is set to', () => {
        for (const preset of TEMPO_PRESETS) {
            expect(presetForTempo(preset.bpm).key).toBe(preset.key);
        }
    });

    // The word is what the transport shows where the digits are turned off, so
    // a tempo set by hand has to read as something rather than as nothing.
    it('names the nearest preset for a tempo set by hand', () => {
        expect(presetForTempo(95).key).toBe('slow');
        expect(presetForTempo(130).key).toBe('normal');
        expect(presetForTempo(180).key).toBe('fast');
    });

    it('gives a tempo exactly between two presets to the slower', () => {
        expect(presetForTempo(105).key).toBe('slow');
        expect(presetForTempo(135).key).toBe('normal');
    });
});
