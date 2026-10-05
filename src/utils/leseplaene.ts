import { BIBEL_BOOKS, type BibelBook, type ChapterRef } from '@/utils/bibel';

/**
 * Reading plans: a stretch of the Bible spread over a number of days.
 *
 * The plans are generated from the book index rather than written out by hand,
 * so a plan can never name a chapter the app does not have, and every chapter
 * of its stretch is read exactly once, in canonical order.
 *
 * Everything here is pure: the day a reader is on is worked out from the date
 * the plan was started and today's date, both passed in, so the store and the
 * tests decide what "today" is.
 */

export interface LeseplanDefinition {
    id: string;
    name: string;
    /** One line under the name: what is read, and at what pace. */
    description: string;
    /** Day by day, the chapters to read. Day 1 is index 0. */
    days: ChapterRef[][];
}

/** Every chapter of the given books, in order. */
export function chaptersOf(books: BibelBook[]): ChapterRef[] {
    return books.flatMap((book) =>
        Array.from({ length: book.chapters }, (_, i) => ({ slug: book.slug, chapter: i + 1 })),
    );
}

/**
 * Cut a run of chapters into `days` portions as even as whole chapters allow:
 * the portions differ by one chapter at most, and the longer ones are spread
 * through the plan instead of piling up at its start or end.
 */
export function spreadOverDays(chapters: ChapterRef[], days: number): ChapterRef[][] {
    if (days < 1) return [];
    return Array.from({ length: days }, (_, day) =>
        chapters.slice(
            Math.floor((day * chapters.length) / days),
            Math.floor(((day + 1) * chapters.length) / days),
        ),
    );
}

function books(predicate: (book: BibelBook) => boolean): BibelBook[] {
    return BIBEL_BOOKS.filter(predicate);
}

const GOSPELS = new Set(['matthaeus', 'markus', 'lukas', 'johannes']);

function plan(
    id: string,
    name: string,
    description: string,
    stretch: BibelBook[],
    days: number,
): LeseplanDefinition {
    return { id, name, description, days: spreadOverDays(chaptersOf(stretch), days) };
}

export const LESEPLAENE: LeseplanDefinition[] = [
    plan(
        'bibel-jahr',
        'Die Bibel in einem Jahr',
        'Von 1. Mose bis zur Offenbarung, drei bis vier Kapitel am Tag.',
        BIBEL_BOOKS,
        365,
    ),
    plan(
        'nt-90',
        'Das Neue Testament in 90 Tagen',
        'Von Matthäus bis zur Offenbarung, etwa drei Kapitel am Tag.',
        books((book) => book.testament === 'NT'),
        90,
    ),
    plan(
        'psalmen-30',
        'Die Psalmen in 30 Tagen',
        'Alle 150 Psalmen, fünf am Tag.',
        books((book) => book.slug === 'psalm'),
        30,
    ),
    plan(
        'evangelien-40',
        'Die Evangelien in 40 Tagen',
        'Matthäus, Markus, Lukas und Johannes, zwei bis drei Kapitel am Tag.',
        books((book) => GOSPELS.has(book.slug)),
        40,
    ),
];

const byId = new Map(LESEPLAENE.map((definition) => [definition.id, definition]));

export function findLeseplan(id: string): LeseplanDefinition | undefined {
    return byId.get(id);
}

/** How many chapters a plan reads in all. */
export function chapterCount(definition: LeseplanDefinition): number {
    return definition.days.reduce((sum, day) => sum + day.length, 0);
}

// --- Dates ------------------------------------------------------------------

/** A date as YYYY-MM-DD in local time: the calendar day the reader sees. */
export function localDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole calendar days from one YYYY-MM-DD to another.
 *
 * Counted on the calendar, not the clock: both days are placed at UTC midnight,
 * where no day is 23 or 25 hours long, so a plan does not slip a day across
 * the change to or from summer time.
 */
export function daysBetween(from: string, to: string): number {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/**
 * The plan day for a date: 1 on the day the plan was started.
 *
 * Not clamped. Past the plan's end it keeps counting, so the caller can tell a
 * finished plan from one that is still running; before the start (a clock set
 * back, a backup restored) it is below 1.
 */
export function dayNumber(startedOn: string, today: Date): number {
    return daysBetween(startedOn, localDateString(today)) + 1;
}

export interface PlanStatus {
    /** The day to show: today's plan day, held within 1 … length. */
    day: number;
    length: number;
    /** Today lies past the plan's last day. */
    over: boolean;
    /** Every day of the plan has been ticked off. */
    complete: boolean;
    /** Days before today that are still open, earliest first. */
    behind: number[];
    /** Days ticked off, within the plan. */
    done: number;
}

/**
 * Where the reader stands in a plan today.
 *
 * Only days *before* today count as behind: today's portion is not late until
 * tomorrow. Once the plan's time has run out every open day is behind,
 * including the last.
 */
export function planStatus(
    definition: LeseplanDefinition,
    startedOn: string,
    doneDays: readonly number[],
    today: Date,
): PlanStatus {
    const length = definition.days.length;
    const raw = dayNumber(startedOn, today);
    const day = Math.min(Math.max(raw, 1), length);
    const over = raw > length;
    const done = new Set(doneDays.filter((n) => n >= 1 && n <= length));

    const lastDue = over ? length : day - 1;
    const behind: number[] = [];
    for (let n = 1; n <= lastDue; n++) if (!done.has(n)) behind.push(n);

    return { day, length, over, complete: done.size === length, behind, done: done.size };
}

/**
 * The plan days, up to and including `uptoDay`, that are still open, contain
 * the given chapter, and would be complete with it.
 *
 * This is how marking a chapter read ticks off a day: today's, or an earlier
 * one being caught up on. Days still ahead are left alone, so reading ahead
 * does not quietly empty tomorrow's portion.
 */
export function daysCompletedBy(
    definition: LeseplanDefinition,
    ref: ChapterRef,
    doneDays: readonly number[],
    uptoDay: number,
    isRead: (ref: ChapterRef) => boolean,
): number[] {
    const done = new Set(doneDays);
    const result: number[] = [];
    const last = Math.min(uptoDay, definition.days.length);
    for (let n = 1; n <= last; n++) {
        if (done.has(n)) continue;
        const chapters = definition.days[n - 1];
        if (!chapters.some((c) => c.slug === ref.slug && c.chapter === ref.chapter)) continue;
        if (chapters.every(isRead)) result.push(n);
    }
    return result;
}

/**
 * The open earlier days, in words: named one by one while there are few,
 * counted once a list of numbers would say less than the count.
 */
export function catchUpText(behind: readonly number[]): string {
    if (behind.length === 0) return '';
    if (behind.length === 1) return `Tag ${behind[0]} ist noch offen.`;
    if (behind.length <= 3) {
        const head = behind.slice(0, -1).join(', ');
        return `Tag ${head} und ${behind.at(-1)} sind noch offen.`;
    }
    return `${behind.length} Tage sind noch offen, ab Tag ${behind[0]}.`;
}
