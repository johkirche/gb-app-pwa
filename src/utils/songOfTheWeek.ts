import type { Song } from '@/db';

/**
 * ISO-8601 week number of a date, together with the week-numbering year it
 * belongs to (the year of that week's Thursday — the last days of December can
 * already count as week 1 of the next year, and vice versa).
 */
export function getIsoWeek(date: Date): { year: number; week: number } {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    // Move to the Thursday of this week — the day that names the ISO week
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const diff = target.getTime() - firstThursday.getTime();

    return {
        year: target.getUTCFullYear(),
        week: 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000)),
    };
}

// A prime larger than any hymnal, so it shares no divisor with the number of
// songs and stepping by it visits every entry before repeating.
const WEEK_STRIDE = 7919;

/**
 * The Lied der Woche: one song out of the whole book, the same one all week.
 *
 * Indexing straight by the week number would only ever reach the first 53
 * songs — that is as high as a week number goes. Stepping through the book by
 * WEEK_STRIDE instead walks the entire library before it comes back around, so
 * every song has its week and consecutive weeks land far apart.
 *
 * The pool is ordered by Liednummer rather than taken as it arrives: the store
 * hands out songs sorted by title, and a rotation that rides on that would
 * shift as soon as a title is corrected.
 */
export function pickSongOfTheWeek(songs: Song[], reference: Date): Song | null {
    const pool = songs.filter((song) => song.index).sort((a, b) => a.index - b.index);
    if (pool.length === 0) return null;

    const { year, week } = getIsoWeek(reference);
    // Weeks counted straight through, so the rotation carries over New Year
    const weeksElapsed = year * 53 + week;

    return pool[(weeksElapsed * WEEK_STRIDE) % pool.length];
}
