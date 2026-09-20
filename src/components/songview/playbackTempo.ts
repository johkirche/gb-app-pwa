/**
 * How fast a hymn is played, in the terms the reader is asked in.
 *
 * A number of beats per minute is the honest unit and the wrong question: the
 * reader of a hymnal wants the song a little slower than the organist took it,
 * not 104. So the transport asks in words — langsam, normal, schnell — and the
 * BPM behind them is what the playback is actually set to, offered as a control
 * of its own only to whoever turns it on (see `exactTempo` in the preferences).
 *
 * The two are one setting, not two: a preset simply names a tempo, and a tempo
 * set by hand is still shown as the preset it lies nearest. Turning the exact
 * control off therefore loses nothing but the digits.
 */
import type { FunctionalComponent } from 'vue';

import { Music4, Rabbit, Turtle } from 'lucide-vue-next';

export type TempoPresetKey = 'slow' | 'normal' | 'fast';

export interface TempoPreset {
    key: TempoPresetKey;
    label: string;
    /** What choosing it means, in a line — the transport offers no other help. */
    hint: string;
    /** The tempo it stands for, in beats per minute */
    bpm: number;
    icon: FunctionalComponent;
}

/** The slowest and fastest the transport will go, and the step it moves in. */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 200;
export const TEMPO_STEP = 5;

/** The tempo a song opens at — the middle preset, and the app's long-standing default. */
export const TEMPO_DEFAULT = 120;

export const TEMPO_PRESETS: readonly TempoPreset[] = [
    {
        key: 'slow',
        label: 'Langsam',
        hint: 'Zum Einüben und Mitlesen',
        bpm: 90,
        icon: Turtle,
    },
    {
        key: 'normal',
        label: 'Normal',
        hint: 'Wie im Gottesdienst gesungen',
        bpm: TEMPO_DEFAULT,
        icon: Music4,
    },
    {
        key: 'fast',
        label: 'Schnell',
        hint: 'Zügig durchgespielt',
        bpm: 150,
        icon: Rabbit,
    },
];

export function clampTempo(bpm: number): number {
    if (!Number.isFinite(bpm)) return TEMPO_DEFAULT;
    return Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(bpm)));
}

/** Move a tempo one step, and no further than the transport goes. */
export function stepTempo(bpm: number, direction: 1 | -1): number {
    return clampTempo(clampTempo(bpm) + direction * TEMPO_STEP);
}

/**
 * The preset a tempo reads as — the nearest one, ties going to the slower.
 *
 * Every tempo names one, including the ones set by hand: the word is what the
 * transport shows where the digits are turned off, and a control that went
 * blank between two presets would be worse than a word that is approximately
 * right.
 */
export function presetForTempo(bpm: number): TempoPreset {
    const wanted = clampTempo(bpm);
    let nearest = TEMPO_PRESETS[0];
    for (const preset of TEMPO_PRESETS) {
        if (Math.abs(preset.bpm - wanted) < Math.abs(nearest.bpm - wanted)) nearest = preset;
    }
    return nearest;
}
