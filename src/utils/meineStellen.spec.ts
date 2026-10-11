import { describe, expect, it } from 'vitest';

import type { Lesezeichen, Markierung, MarkierungsFarbe, Notiz } from '@/db';

import {
    clearsOf,
    filterStellen,
    groupByBook,
    joinRuns,
    stelleLabel,
    stellen,
} from './meineStellen';

const day = (n: number) => new Date(2026, 9, n);

const mark = (
    slug: string,
    chapter: number,
    verse: number,
    color: MarkierungsFarbe,
    at: Date,
): Markierung => ({
    id: `${slug}/${chapter}/${verse}`,
    slug,
    chapter,
    verse,
    color,
    createdAt: at,
});

const note = (slug: string, chapter: number, verse: number, text: string, at: Date): Notiz => ({
    id: `${slug}/${chapter}/${verse}`,
    slug,
    chapter,
    verse,
    text,
    updatedAt: at,
});

const bookmark = (
    slug: string,
    chapter: number,
    verse: number,
    snippet: string,
    at: Date,
): Lesezeichen => ({
    id: `${slug}/${chapter}/${verse}`,
    slug,
    chapter,
    verse,
    snippet,
    createdAt: at,
});

// Matthäus 5,3-5 marked as one passage, Psalm 23,4 kept three ways, a
// bookmark in 1. Mose, a note in Johannes.
const lesezeichen = [
    bookmark('psalm', 23, 4, 'Und ob ich schon wanderte', day(2)),
    bookmark('1-mose', 1, 1, 'Im Anfang schuf Gott', day(1)),
];
const markierungen = [
    mark('matthaeus', 5, 4, 'rosa', day(3)),
    mark('matthaeus', 5, 3, 'rosa', day(3)),
    mark('matthaeus', 5, 5, 'rosa', day(3)),
    mark('psalm', 23, 4, 'gelb', day(2)),
];
const notizen = [
    note('psalm', 23, 4, 'Trost im finstern Tal', day(5)),
    note('johannes', 3, 16, 'Mein Konfirmationsspruch', day(4)),
];
const rows = stellen(lesezeichen, markierungen, notizen);

describe('stellen', () => {
    it('makes one row of a verse kept three ways, dated by the last touch', () => {
        const psalm = rows.find((r) => r.id === 'psalm/23/4')!;
        expect(psalm).toMatchObject({
            lesezeichen: 'Und ob ich schon wanderte',
            color: 'gelb',
            note: 'Trost im finstern Tal',
            at: day(5),
        });
        expect(rows.filter((r) => r.id === 'psalm/23/4')).toHaveLength(1);
    });

    it('puts the newest first, and a passage marked at once in verse order', () => {
        expect(rows.map((r) => r.id)).toEqual([
            'psalm/23/4',
            'johannes/3/16',
            'matthaeus/5/3',
            'matthaeus/5/4',
            'matthaeus/5/5',
            '1-mose/1/1',
        ]);
    });
});

describe('joinRuns', () => {
    it('joins a highlighted run into one row', () => {
        const joined = joinRuns(rows);
        const run = joined.find((r) => r.slug === 'matthaeus')!;
        expect(run.verses).toEqual([3, 4, 5]);
        expect(stelleLabel(run)).toBe('Matthäus 5,3-5');
        expect(joined).toHaveLength(4);
    });

    it('keeps apart verses of another colour, with a gap, or with a note', () => {
        const apart = joinRuns(
            stellen(
                [],
                [
                    mark('psalm', 1, 1, 'gelb', day(1)),
                    mark('psalm', 1, 2, 'blau', day(1)),
                    mark('psalm', 1, 4, 'blau', day(1)),
                    mark('psalm', 1, 5, 'blau', day(1)),
                ],
                [note('psalm', 1, 5, 'Wie ein Baum', day(1))],
            ),
        );
        expect(apart.map((r) => r.verses)).toEqual([[1], [2], [4], [5]]);
    });
});

describe('filterStellen', () => {
    it('sorts into the canon’s order, book by book', () => {
        const byBook = filterStellen(rows, { art: 'alle', ordnung: 'buch' });
        expect(byBook.map(stelleLabel)).toEqual([
            '1. Mose 1,1',
            'Psalm 23,4',
            'Matthäus 5,3-5',
            'Johannes 3,16',
        ]);
        expect(groupByBook(byBook).map((g) => [g.book.name, g.rows.length])).toEqual([
            ['1. Mose', 1],
            ['Psalm', 1],
            ['Matthäus', 1],
            ['Johannes', 1],
        ]);
    });

    it('keeps only the kind asked for, and the colour', () => {
        const label = (art: 'lesezeichen' | 'notizen' | 'markierungen') =>
            filterStellen(rows, { art, ordnung: 'buch' }).map(stelleLabel);
        expect(label('lesezeichen')).toEqual(['1. Mose 1,1', 'Psalm 23,4']);
        expect(label('notizen')).toEqual(['Psalm 23,4', 'Johannes 3,16']);
        expect(label('markierungen')).toEqual(['Psalm 23,4', 'Matthäus 5,3-5']);
        expect(
            filterStellen(rows, { art: 'markierungen', farbe: 'rosa', ordnung: 'buch' }).map(
                stelleLabel,
            ),
        ).toEqual(['Matthäus 5,3-5']);
    });

    it('finds words in the reference, the note and the snippet, ignoring case', () => {
        const find = (query: string) =>
            filterStellen(rows, { art: 'alle', ordnung: 'buch', query }).map(stelleLabel);
        expect(find('konfirmation')).toEqual(['Johannes 3,16']);
        expect(find('anfang')).toEqual(['1. Mose 1,1']);
        expect(find('Psalm 23')).toEqual(['Psalm 23,4']);
        expect(find('trost tal')).toEqual(['Psalm 23,4']);
        expect(find('nirgends')).toEqual([]);
    });
});

describe('clearsOf', () => {
    const psalm = rows.find((r) => r.id === 'psalm/23/4')!;

    it('clears everything under „Alle"', () => {
        expect(clearsOf(psalm, 'alle')).toEqual({
            lesezeichen: true,
            markierung: true,
            notiz: true,
        });
    });

    it('clears only what is filtered for', () => {
        expect(clearsOf(psalm, 'lesezeichen')).toEqual({
            lesezeichen: true,
            markierung: false,
            notiz: false,
        });
    });
});
