/**
 * How often a hymn is played through.
 *
 * Counted in passes, not in repeats: "3" means the melody sounds three times,
 * which is what a reader singing three verses is asking for. One pass is
 * therefore the same thing as no repeat at all, and needs no separate off flag.
 *
 * Endless is `Infinity` rather than a sentinel of its own, so every comparison
 * the playback makes — has this pass been reached, is another one owed — is the
 * same arithmetic in both cases.
 */

/** Played once: what every song opens on. */
export const REPEAT_ONCE = 1;

/** Round and round until the reader stops it. */
export const REPEAT_ENDLESS = Number.POSITIVE_INFINITY;

/** As many passes as the panel will count to. Beyond this, endless is meant. */
export const REPEAT_MAX = 20;

/** Positive infinity and nothing else — a count that is no number at all is a
 *  mistake to be clamped away, not an instruction to play for ever. */
export function isEndless(times: number): boolean {
    return times === REPEAT_ENDLESS;
}

/** A pass count the transport can actually honour. Endless survives as itself. */
export function clampRepeat(times: number): number {
    if (isEndless(times)) return REPEAT_ENDLESS;
    if (!Number.isFinite(times)) return REPEAT_ONCE;
    return Math.max(REPEAT_ONCE, Math.min(REPEAT_MAX, Math.round(times)));
}

/**
 * What the transport button says beside its icon — nothing at all where the
 * song is played once, because that is the state the icon alone already means.
 */
export function repeatBadge(times: number): string {
    if (isEndless(times)) return '∞';
    return clampRepeat(times) > REPEAT_ONCE ? `${clampRepeat(times)}×` : '';
}

/** The whole state in words, for the button's accessible name. */
export function repeatLabel(times: number): string {
    if (isEndless(times)) return 'Endlos wiederholen';
    const passes = clampRepeat(times);
    return passes > REPEAT_ONCE ? `${passes}× spielen` : 'Einmal spielen';
}

/**
 * The count the panel opens on when repeating is off.
 *
 * The verses are the reason anyone repeats a hymn at all, so their number is
 * the proposal — and a song whose verses are unknown, or which has only the one
 * printed under its notes, is proposed the plain second pass instead.
 */
export function proposedRepeat(verseCount: number): number {
    return clampRepeat(verseCount > REPEAT_ONCE ? verseCount : 2);
}
