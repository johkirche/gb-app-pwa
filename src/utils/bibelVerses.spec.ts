import { describe, expect, it } from 'vitest';

import type { Block } from './bibel';
import { layoutChapter } from './bibelLayout';
import {
    copyText,
    noteParts,
    toggleVerse,
    verseEnds,
    verseEntries,
    verseListLabel,
    versesRefLabel,
} from './bibelVerses';

// Psalm 23,1-3, shortened: verse 1 runs over two lines, verse 2 carries a
// footnote in the middle.
const blocks: Block[] = [
    { h: 3, t: 'Der Herr als der gute Hirt' },
    {
        p: [
            { s: [{ v: 1 }, { e: 'Ein Psalm von David.' }] },
            { s: ['Der HERR ist mein Hirt: mir mangelt nichts.'] },
            { s: [{ v: 2 }, 'Auf grünen Auen', { n: 'oder: Weiden' }, ' läßt er mich lagern.'] },
            { s: [{ v: 3 }, 'Er erquickt meine Seele.'] },
        ],
        q: 1,
    },
];
const laid = layoutChapter(blocks);
const psalm23 = { slug: 'psalm', chapter: 23 };

describe('toggleVerse', () => {
    it('adds a verse in order, and takes it out again', () => {
        expect(toggleVerse([1, 5], 3)).toEqual([1, 3, 5]);
        expect(toggleVerse([1, 3, 5], 3)).toEqual([1, 5]);
        expect(toggleVerse([], 7)).toEqual([7]);
    });
});

describe('verseListLabel', () => {
    it('writes a run with a dash and gaps with dots', () => {
        expect(verseListLabel([4])).toBe('4');
        expect(verseListLabel([1, 2])).toBe('1-2');
        expect(verseListLabel([1, 3, 5])).toBe('1.3.5');
        expect(verseListLabel([7, 1, 2, 3, 5])).toBe('1-3.5.7');
    });
});

describe('versesRefLabel', () => {
    it('cites chapter and verses', () => {
        expect(versesRefLabel(psalm23, [1, 2])).toBe('Psalm 23,1-2');
        expect(versesRefLabel(psalm23, [1, 3])).toBe('Psalm 23,1.3');
    });

    it('leaves the chapter out in a book of one', () => {
        expect(versesRefLabel({ slug: 'judas', chapter: 1 }, [3, 4])).toBe('Judas 3-4');
    });
});

describe('copyText', () => {
    it('quotes the verses with their reference and translation', () => {
        expect(copyText(laid, psalm23, [2, 1])).toBe(
            '„Ein Psalm von David. Der HERR ist mein Hirt: mir mangelt nichts. ' +
                'Auf grünen Auen läßt er mich lagern.“ (Psalm 23,1-2, Menge)',
        );
    });

    it('marks a gap in the selection', () => {
        expect(copyText(laid, psalm23, [1, 3])).toBe(
            '„Ein Psalm von David. Der HERR ist mein Hirt: mir mangelt nichts. … ' +
                'Er erquickt meine Seele.“ (Psalm 23,1.3, Menge)',
        );
    });
});

describe('verseEnds', () => {
    it('finds the last run of each verse, past its footnote', () => {
        expect(verseEnds(laid)).toEqual(
            new Map([
                ['1.1.0', 1],
                ['1.2.3', 2],
                ['1.3.1', 3],
            ]),
        );
    });
});

describe('verseEntries', () => {
    const at = (day: number) => new Date(`2026-10-0${day}`);
    const where = (verse: number) => ({
        id: `psalm/23/${verse}`,
        slug: 'psalm',
        chapter: 23,
        verse,
    });

    it('joins a verse marked and written on into one entry, newest first', () => {
        const entries = verseEntries(
            [
                { ...where(1), color: 'gelb', createdAt: at(1) },
                { ...where(4), color: 'blau', createdAt: at(3) },
            ],
            [{ ...where(1), text: 'Taufspruch', updatedAt: at(5) }],
        );

        expect(entries).toEqual([
            { ...where(1), color: 'gelb', note: 'Taufspruch', at: at(5) },
            { ...where(4), color: 'blau', at: at(3) },
        ]);
    });
});

describe('noteParts', () => {
    it('cuts the references out of a footnote', () => {
        const parts = noteParts('vgl. Ps 130,8; Jes 7,14.');
        expect(parts.map((part) => part.text)).toEqual([
            'vgl. ',
            'Ps 130,8',
            '; ',
            'Jes 7,14',
            '.',
        ]);
        expect(parts[1].ref).toEqual({ slug: 'psalm', chapter: 130, verse: 8 });
        expect(parts[3].ref).toMatchObject({ slug: 'jesaja', chapter: 7, verse: 14 });
    });

    it('leaves a footnote without references whole', () => {
        expect(noteParts('oder: Weiden')).toEqual([{ text: 'oder: Weiden' }]);
    });
});
