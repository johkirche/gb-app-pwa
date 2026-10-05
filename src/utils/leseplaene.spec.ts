import { afterAll, describe, expect, it } from 'vitest';

import { BIBEL_BOOKS, type ChapterRef } from '@/utils/bibel';
import {
    LESEPLAENE,
    type LeseplanDefinition,
    chapterCount,
    chaptersOf,
    dayNumber,
    daysBetween,
    daysCompletedBy,
    findLeseplan,
    localDateString,
    planStatus,
    spreadOverDays,
} from '@/utils/leseplaene';

// Summer time has to be real for the DST cases below. Put back afterwards, so
// a worker reused for another spec file does not keep Berlin time.
const originalTz = process.env.TZ;
process.env.TZ = 'Europe/Berlin';
afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
});

const key = (ref: ChapterRef) => `${ref.slug}/${ref.chapter}`;

function plan(id: string): LeseplanDefinition {
    const definition = findLeseplan(id);
    if (!definition) throw new Error(`no plan ${id}`);
    return definition;
}

describe('spreadOverDays', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ slug: 'x', chapter: i + 1 }));

    it('keeps every chapter, in order, once', () => {
        expect(spreadOverDays(ten, 3).flat()).toEqual(ten);
    });

    it('lets portions differ by one chapter at most', () => {
        const sizes = spreadOverDays(ten, 4).map((day) => day.length);
        expect(sizes).toEqual([2, 3, 2, 3]);
    });

    it('leaves days empty rather than splitting a chapter, when days outnumber chapters', () => {
        const days = spreadOverDays(ten.slice(0, 2), 4);
        expect(days).toHaveLength(4);
        expect(days.flat()).toHaveLength(2);
    });

    it('makes no days out of none', () => {
        expect(spreadOverDays(ten, 0)).toEqual([]);
    });
});

describe('the plans', () => {
    it('reads the whole Bible in a year, three or four chapters a day', () => {
        const year = plan('bibel-jahr');
        expect(year.days).toHaveLength(365);
        expect(chapterCount(year)).toBe(1189);
        expect(new Set(year.days.flat().map(key)).size).toBe(1189);
        const sizes = new Set(year.days.map((day) => day.length));
        expect([...sizes].sort()).toEqual([3, 4]);
        expect(year.days[0][0]).toEqual({ slug: '1-mose', chapter: 1 });
        expect(year.days[364].at(-1)).toEqual({ slug: 'offenbarung', chapter: 22 });
    });

    it('reads the New Testament in 90 days', () => {
        const nt = plan('nt-90');
        expect(nt.days).toHaveLength(90);
        expect(chapterCount(nt)).toBe(260);
        expect(nt.days[0][0]).toEqual({ slug: 'matthaeus', chapter: 1 });
    });

    it('reads five Psalms a day for 30 days', () => {
        const psalms = plan('psalmen-30');
        expect(psalms.days).toHaveLength(30);
        expect(psalms.days.every((day) => day.length === 5)).toBe(true);
        expect(psalms.days[29].at(-1)).toEqual({ slug: 'psalm', chapter: 150 });
    });

    it('reads the four Gospels in 40 days', () => {
        const gospels = plan('evangelien-40');
        expect(gospels.days).toHaveLength(40);
        expect(chapterCount(gospels)).toBe(28 + 16 + 24 + 21);
        expect(new Set(gospels.days.flat().map((ref) => ref.slug))).toEqual(
            new Set(['matthaeus', 'markus', 'lukas', 'johannes']),
        );
    });

    it('names only chapters the Bible has', () => {
        const chapters = new Set(chaptersOf(BIBEL_BOOKS).map(key));
        for (const definition of LESEPLAENE) {
            for (const ref of definition.days.flat()) expect(chapters.has(key(ref))).toBe(true);
        }
    });
});

describe('dates', () => {
    it('writes the local calendar day, not the UTC one', () => {
        // 00:30 in Berlin is still the evening before in UTC.
        expect(localDateString(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05');
        expect(localDateString(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
    });

    it('counts calendar days across months and years', () => {
        expect(daysBetween('2026-10-05', '2026-10-05')).toBe(0);
        expect(daysBetween('2026-01-31', '2026-03-01')).toBe(29);
        expect(daysBetween('2027-12-31', '2028-03-01')).toBe(61); // a leap year
        expect(daysBetween('2026-10-05', '2026-10-01')).toBe(-4);
    });

    it('is day 1 on the day the plan starts, from morning to midnight', () => {
        expect(dayNumber('2026-10-05', new Date(2026, 9, 5, 0, 0))).toBe(1);
        expect(dayNumber('2026-10-05', new Date(2026, 9, 5, 23, 59))).toBe(1);
        expect(dayNumber('2026-10-05', new Date(2026, 9, 6, 0, 1))).toBe(2);
    });

    it('does not slip a day when summer time begins or ends', () => {
        // The test runs in Berlin time: these days really are 23 and 25 hours.
        expect(new Date(2026, 2, 28).getTimezoneOffset()).not.toBe(
            new Date(2026, 2, 30).getTimezoneOffset(),
        );
        // Started the Saturday before the clocks go forward; Monday just after midnight.
        expect(dayNumber('2026-03-28', new Date(2026, 2, 30, 0, 10))).toBe(3);
        // Started the Saturday before they go back; Sunday late and Monday early.
        expect(dayNumber('2026-10-24', new Date(2026, 9, 25, 23, 50))).toBe(2);
        expect(dayNumber('2026-10-24', new Date(2026, 9, 26, 0, 10))).toBe(3);
    });
});

describe('planStatus', () => {
    const psalms = plan('psalmen-30');
    const start = '2026-10-01';

    it('finds today, and nothing behind on the first day', () => {
        expect(planStatus(psalms, start, [], new Date(2026, 9, 1, 8))).toEqual({
            day: 1,
            length: 30,
            over: false,
            complete: false,
            behind: [],
            done: 0,
        });
    });

    it('counts the open days before today as behind, but not today', () => {
        const status = planStatus(psalms, start, [1, 3], new Date(2026, 9, 5, 8));
        expect(status.day).toBe(5);
        expect(status.behind).toEqual([2, 4]);
        expect(status.done).toBe(2);
    });

    it('stays on the last day once the time is up, with the last day behind too', () => {
        const done = Array.from({ length: 28 }, (_, i) => i + 1);
        const status = planStatus(psalms, start, done, new Date(2026, 11, 24));
        expect(status.day).toBe(30);
        expect(status.over).toBe(true);
        expect(status.behind).toEqual([29, 30]);
        expect(status.complete).toBe(false);
    });

    it('is complete when every day is ticked off, early or late', () => {
        const all = Array.from({ length: 30 }, (_, i) => i + 1);
        expect(planStatus(psalms, start, all, new Date(2026, 9, 20)).complete).toBe(true);
        expect(planStatus(psalms, start, all, new Date(2027, 0, 1)).complete).toBe(true);
        expect(planStatus(psalms, start, all, new Date(2027, 0, 1)).behind).toEqual([]);
    });

    it('holds at day 1 when the clock stands before the start', () => {
        const status = planStatus(psalms, start, [], new Date(2026, 8, 28));
        expect(status.day).toBe(1);
        expect(status.behind).toEqual([]);
    });

    it('ignores ticks outside the plan', () => {
        expect(planStatus(psalms, start, [0, 31, 2], new Date(2026, 9, 3)).done).toBe(1);
    });
});

describe('daysCompletedBy', () => {
    const psalms = plan('psalmen-30');
    const readSet = (...chapters: number[]) => {
        const read = new Set(chapters);
        return (ref: ChapterRef) => ref.slug === 'psalm' && read.has(ref.chapter);
    };

    it('ticks off today once its last chapter is read', () => {
        const read = readSet(6, 7, 8, 9, 10);
        expect(daysCompletedBy(psalms, { slug: 'psalm', chapter: 10 }, [], 2, read)).toEqual([2]);
    });

    it('leaves a day open while a chapter of it is unread', () => {
        const read = readSet(6, 7, 10);
        expect(daysCompletedBy(psalms, { slug: 'psalm', chapter: 10 }, [], 2, read)).toEqual([]);
    });

    it('ticks off an earlier day being caught up on', () => {
        const read = readSet(1, 2, 3, 4, 5);
        expect(daysCompletedBy(psalms, { slug: 'psalm', chapter: 3 }, [], 4, read)).toEqual([1]);
    });

    it('does not tick off a day still ahead', () => {
        const read = readSet(11, 12, 13, 14, 15);
        expect(daysCompletedBy(psalms, { slug: 'psalm', chapter: 15 }, [], 2, read)).toEqual([]);
    });

    it('leaves a day already ticked off alone', () => {
        const read = readSet(1, 2, 3, 4, 5);
        expect(daysCompletedBy(psalms, { slug: 'psalm', chapter: 5 }, [1], 1, read)).toEqual([]);
    });

    it('can tick the last day after the time has run out', () => {
        const read = readSet(146, 147, 148, 149, 150);
        expect(daysCompletedBy(psalms, { slug: 'psalm', chapter: 150 }, [], 45, read)).toEqual([
            30,
        ]);
    });

    it('ignores a chapter the plan does not read', () => {
        expect(
            daysCompletedBy(psalms, { slug: 'johannes', chapter: 1 }, [], 30, () => true),
        ).toEqual([]);
    });
});
