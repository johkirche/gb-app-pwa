import { describe, expect, it } from 'vitest';

import type { Block } from '@/utils/bibel';
import { layoutChapter } from '@/utils/bibelLayout';

import { bookContents, readAloudQueue, swipeTurn, verseAtTop } from './bibelReader';

describe('swipeTurn', () => {
    const base = { startX: 200, dx: 0, dy: 0, ms: 200, width: 400 };

    it('turns to the next chapter on a leftward flick, and back on a rightward one', () => {
        expect(swipeTurn({ ...base, dx: -120, dy: 10 })).toBe('next');
        expect(swipeTurn({ ...base, dx: 120, dy: -10 })).toBe('prev');
    });

    it('leaves a short stroke alone', () => {
        expect(swipeTurn({ ...base, dx: -40 })).toBeNull();
    });

    it('takes a mostly vertical stroke for a scroll', () => {
        expect(swipeTurn({ ...base, dx: -100, dy: 60 })).toBeNull();
        expect(swipeTurn({ ...base, dx: -100, dy: 45 })).toBe('next');
    });

    it('takes a slow drag for reading or selecting, not turning', () => {
        expect(swipeTurn({ ...base, dx: -150, ms: 1200 })).toBeNull();
    });

    it("leaves the system's edge gestures to the system", () => {
        expect(swipeTurn({ ...base, startX: 10, dx: 150 })).toBeNull();
        expect(swipeTurn({ ...base, startX: 392, dx: -150 })).toBeNull();
    });
});

describe('verseAtTop', () => {
    const positions = [
        { verse: 1, top: 100 },
        { verse: 2, top: 160 },
        { verse: 3, top: 260 },
    ];

    it('is the first verse while none has reached the top edge', () => {
        expect(verseAtTop(positions, 50)).toBe(1);
    });

    it('is the verse whose words run on across the top edge', () => {
        expect(verseAtTop(positions, 200)).toBe(2);
        expect(verseAtTop(positions, 1000)).toBe(3);
    });

    it('counts a number just under the edge as there', () => {
        expect(verseAtTop(positions, 150, 12)).toBe(2);
    });

    it('is nothing in a chapter without verses', () => {
        expect(verseAtTop([], 0)).toBeNull();
    });
});

const chapter: Block[] = [
    { h: 3, t: 'Die zwei Lebenswege' },
    {
        p: [
            { s: [{ v: 1 }, 'Wohl dem, der nicht wandelt'] },
            { s: ['im Rat', { n: '= nach den Lehren' }, ' der Gottlosen'], i: 2 },
            { s: [{ v: 2 }, 'vielmehr Gefallen hat'] },
            { s: [{ v: 3 }] },
            { s: [{ v: 4 }, { e: 'Nicht so' }, ' die Gottlosen'] },
        ],
        q: 1,
    },
];

describe('readAloudQueue', () => {
    const laid = layoutChapter(chapter);

    it('reads every verse with words, without numbers or footnotes', () => {
        expect(readAloudQueue(laid)).toEqual([
            { verse: 1, text: 'Wohl dem, der nicht wandelt im Rat der Gottlosen' },
            { verse: 2, text: 'vielmehr Gefallen hat' },
            { verse: 4, text: 'Nicht so die Gottlosen' },
        ]);
    });

    it('starts at the verse asked for', () => {
        expect(readAloudQueue(laid, 2).map((entry) => entry.verse)).toEqual([2, 4]);
    });

    it('starts at the beginning when the verse is not in the chapter', () => {
        expect(readAloudQueue(laid, 99).map((entry) => entry.verse)).toEqual([1, 2, 4]);
    });
});

describe('bookContents', () => {
    const book: Block[][] = [
        [
            { h: 2, t: 'Einleitung' },
            { h: 3, t: 'Johannes der Täufer' },
            { p: [{ s: [{ v: 1 }, 'Anfang'] }, { s: [{ v: 2 }, 'Weiter'] }] },
            { h: 4, t: 'Eine Unterabteilung' },
            { p: [{ s: [{ v: 3 }, 'Drei'] }] },
            { h: 3, t: 'Jesu Taufe' },
            { p: [{ s: [{ v: 9 }, 'Neun'] }] },
            { h: 3, t: 'Am Fuß des Kapitels' },
        ],
        [{ p: [{ s: [{ v: 1 }, 'Eins'] }] }],
    ];

    it('lists the divisions and sections with the place each starts', () => {
        expect(bookContents(book)).toEqual([
            { level: 2, text: 'Einleitung', chapter: 1 },
            { level: 3, text: 'Johannes der Täufer', chapter: 1 },
            { level: 3, text: 'Jesu Taufe', chapter: 1, verse: 9 },
            { level: 3, text: 'Am Fuß des Kapitels', chapter: 2 },
        ]);
    });

    it('leaves out the subsections', () => {
        expect(bookContents(book).some((entry) => entry.level === 4)).toBe(false);
    });
});
