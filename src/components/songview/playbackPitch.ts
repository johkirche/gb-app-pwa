/**
 * How high the hymn is played, against how it is printed.
 *
 * A congregation cannot always reach the key the book is set in, and whoever
 * leads the singing answers that by taking the whole thing a step or two
 * lower. This is that step — and nothing else: the offset is added to the
 * notes on their way to the instrument and the engraving is left alone. What
 * stands on the page is still the book's, in the book's key, whatever comes
 * out of the speaker. The panel says so in as many words, because a key name
 * that did not match the sheet under it would otherwise read as a fault.
 *
 * That is also why it is not offered to everyone. A reader looking up a hymn
 * in a pew has no use for it and would only be asked a question they did not
 * come with; whoever leads turns it on once in Einstellungen → Wiedergabe and
 * has it in the transport from then on. See `pitchControl` in the preferences.
 *
 * The key is named in German — F-Dur, es-Moll — because that is what the
 * person moving it thinks in, and the naming goes through the circle of fifths
 * rather than through pitch classes: a signature knows whether it is written
 * with sharps or with flats, and a pitch class does not, which is the whole
 * difference between Ges-Dur and Fis-Dur.
 */
import type { FunctionalComponent } from 'vue';

import { ArrowUpDown } from 'lucide-vue-next';

/**
 * How far the transport moves the music, in half-tones.
 *
 * The sibling player (gb-pwa) clamps at two octaves, but that is a sanity
 * bound on whatever a MIDI file carries rather than an offer to a leader: past
 * an octave the melody has left the register anyone sings in, and every key
 * has already come round once on the way. So an octave either side, and the
 * step is the half-tone — the only unit in which "a little lower" is a
 * question the score can answer exactly.
 */
export const PITCH_MIN = -12;
export const PITCH_MAX = 12;

/** The hymn as printed — where the control rests until somebody moves it. */
export const PITCH_NONE = 0;

/** The transport's icon for the control, so the button and the switch agree. */
export const PITCH_ICON: FunctionalComponent = ArrowUpDown;

/**
 * A key, as a signature rather than as a tonic.
 *
 * `fifths` is the position on the circle of fifths that MusicXML and OSMD both
 * count in: sharps positive, flats negative, C-Dur and a-Moll at zero.
 */
export interface SongKey {
    fifths: number;
    minor: boolean;
}

/** Tonic of each signature, from seven flats to seven sharps. */
const MAJOR_BY_FIFTHS = [
    'Ces',
    'Ges',
    'Des',
    'As',
    'Es',
    'B',
    'F',
    'C',
    'G',
    'D',
    'A',
    'E',
    'H',
    'Fis',
    'Cis',
];

/** The relative minor of each of those — same signature, tonic a third below. */
const MINOR_BY_FIFTHS = [
    'as',
    'es',
    'b',
    'f',
    'c',
    'g',
    'd',
    'a',
    'e',
    'h',
    'fis',
    'cis',
    'gis',
    'dis',
    'ais',
];

/** Index into both tables: C-Dur / a-Moll sit in the middle. */
const NATURAL = 7;

export function clampPitch(semitones: number): number {
    if (!Number.isFinite(semitones)) return PITCH_NONE;
    return Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.round(semitones)));
}

/** Move the offset one half-tone, and no further than the transport goes. */
export function stepPitch(semitones: number, direction: 1 | -1): number {
    return clampPitch(clampPitch(semitones) + direction);
}

/**
 * The key a signature lands in when the music is moved by so many half-tones.
 *
 * A half-tone up is seven steps along the circle of fifths, which runs off the
 * end of what anyone writes after a few moves, so the result is folded back
 * into the twelve signatures that are actually used. The fold lands on the
 * flat side of the enharmonic pair — Ges-Dur rather than Fis-Dur, es-Moll
 * rather than dis-Moll — which is the spelling a German hymnal reaches for.
 */
export function transposeKey(key: SongKey, semitones: number): SongKey {
    const moved = key.fifths + 7 * clampPitch(semitones);
    return { fifths: ((((moved + 6) % 12) + 12) % 12) - 6, minor: key.minor };
}

/** „F-Dur", „es-Moll" — or null for a signature nobody writes. */
export function germanKeyName(key: SongKey): string | null {
    const name = (key.minor ? MINOR_BY_FIFTHS : MAJOR_BY_FIFTHS)[key.fifths + NATURAL];
    if (!name) return null;
    return `${name}-${key.minor ? 'Moll' : 'Dur'}`;
}

/**
 * What the hymn sounds in at this offset, where the sheet named a key at all.
 *
 * Null is the ordinary case for a modal or unmarked sheet, and for one whose
 * key OSMD could not read — the control then counts half-tones instead, which
 * is less to go on but never wrong.
 */
export function soundingKeyName(key: SongKey | null, semitones: number): string | null {
    if (!key) return null;
    return germanKeyName(transposeKey(key, semitones));
}

/** The offset itself, for a sheet whose key has no name: „Original", „+2", „−3". */
export function pitchLabel(semitones: number): string {
    const value = clampPitch(semitones);
    if (value === PITCH_NONE) return 'Original';
    return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}

/** The same in words, which is what says which way is which. */
export function pitchHint(semitones: number): string {
    const value = clampPitch(semitones);
    if (value === PITCH_NONE) return 'Wie notiert';
    const steps = Math.abs(value);
    return `${steps} ${steps === 1 ? 'Halbton' : 'Halbtöne'} ${value > 0 ? 'höher' : 'tiefer'}`;
}
