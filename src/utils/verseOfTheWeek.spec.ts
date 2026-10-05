import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Block } from '@/utils/bibel';
import { layoutChapter, verseText } from '@/utils/bibelLayout';
import { parseReference } from '@/utils/bibelRef';
import { VERSES_OF_THE_WEEK, pickVerseOfTheWeek, versesOf } from '@/utils/verseOfTheWeek';

// The books as the app fetches them, read straight from public/.
function chapterOf(slug: string, chapter: number): Block[] {
    const file = resolve(__dirname, `../../public/bibeltext/menge/${slug}.json`);
    const book = JSON.parse(readFileSync(file, 'utf-8')) as { chapters: Block[][] };
    return book.chapters[chapter - 1];
}

describe('VERSES_OF_THE_WEEK', () => {
    it('has one verse for every ISO week, 53 included', () => {
        expect(VERSES_OF_THE_WEEK).toHaveLength(53);
        expect(new Set(VERSES_OF_THE_WEEK).size).toBe(53);
    });

    it.each(VERSES_OF_THE_WEEK)('„%s“ steht so in der Menge-Bibel', (label) => {
        const ref = parseReference(label);
        expect(ref?.verse).toBeDefined();
        const laid = layoutChapter(chapterOf(ref!.slug, ref!.chapter));
        for (const verse of versesOf({ ...ref!, verse: ref!.verse! })) {
            expect(verseText(laid, verse)).not.toBe('');
        }
    });
});

describe('pickVerseOfTheWeek', () => {
    it('gives the week its verse, the same all week', () => {
        // Montag und Sonntag der 41. Woche 2026
        const monday = pickVerseOfTheWeek(new Date('2026-10-05T08:00:00'));
        const sunday = pickVerseOfTheWeek(new Date('2026-10-11T22:00:00'));
        expect(monday?.label).toBe(VERSES_OF_THE_WEEK[40]);
        expect(sunday).toEqual(monday);
    });

    it('moves on with the next week', () => {
        expect(pickVerseOfTheWeek(new Date('2026-10-12T08:00:00'))?.label).toBe(
            VERSES_OF_THE_WEEK[41],
        );
    });

    it('lands on Christmas in the Christmas week', () => {
        const pick = pickVerseOfTheWeek(new Date('2026-12-24T12:00:00'));
        expect(pick?.label).toBe('Lukas 2,10-11');
        expect(pick?.ref).toEqual({ slug: 'lukas', chapter: 2, verse: 10, endVerse: 11 });
    });

    it('has a verse for week 53 too', () => {
        // Der 1. Januar 2027 gehört zur 53. Woche 2026
        expect(pickVerseOfTheWeek(new Date('2027-01-01T12:00:00'))?.label).toBe(
            VERSES_OF_THE_WEEK[52],
        );
    });

    it('wraps a shorter list round', () => {
        expect(pickVerseOfTheWeek(new Date('2026-01-14T12:00:00'), ['Psalm 23,1'])?.label).toBe(
            'Psalm 23,1',
        );
        expect(pickVerseOfTheWeek(new Date(), [])).toBeNull();
    });

    it('is null for an entry that names no single verse', () => {
        expect(pickVerseOfTheWeek(new Date('2026-01-08T12:00:00'), ['Psalm 23'])).toBeNull();
    });
});

describe('versesOf', () => {
    it('spells out a short run', () => {
        expect(versesOf({ slug: 'roemer', chapter: 8, verse: 38, endVerse: 39 })).toEqual([38, 39]);
        expect(versesOf({ slug: 'psalm', chapter: 23, verse: 1 })).toEqual([1]);
    });
});
