import { describe, expect, it } from 'vitest';

import type { Block } from './bibel';
import { layoutChapter, snippet, verseText, versesOf } from './bibelLayout';

// Psalm 23,1-2 as the build writes it: a heading, then poetry whose verse 1
// runs over two lines and carries a footnote in verse 2.
const blocks: Block[] = [
    { h: 3, t: 'Der Herr als der gute Hirt' },
    {
        p: [
            { s: [{ v: 1 }, { e: 'Ein Psalm von David.' }] },
            { s: ['Der HERR ist mein Hirt: mir mangelt nichts.'] },
            { s: [{ v: 2 }, 'Auf grünen Auen', { n: 'oder: Weiden' }, ' läßt er mich lagern,'] },
            { s: ['zum Lagerplatz am Bache führt er mich.'], i: 2 },
        ],
        q: 1,
    },
];

describe('layoutChapter', () => {
    const laid = layoutChapter(blocks);

    it('keeps headings and marks poetry', () => {
        expect(laid[0]).toEqual({ kind: 'heading', level: 3, text: 'Der Herr als der gute Hirt' });
        expect(laid[1]).toMatchObject({ kind: 'para', poetry: true });
    });

    it('tells every run which verse it belongs to, across lines', () => {
        const para = laid[1];
        if (para.kind !== 'para') throw new Error('expected a paragraph');
        expect(para.lines[1].segments[0]).toMatchObject({ kind: 'text', verse: 1 });
        expect(para.lines[3]).toMatchObject({ indent: 2, segments: [{ verse: 2 }] });
    });

    it('lists the verses in order', () => {
        expect(versesOf(laid)).toEqual([1, 2]);
    });
});

describe('verseText', () => {
    const laid = layoutChapter(blocks);

    it('joins a verse across lines and leaves the footnotes out', () => {
        expect(verseText(laid, 1)).toBe(
            'Ein Psalm von David. Der HERR ist mein Hirt: mir mangelt nichts.',
        );
        expect(verseText(laid, 2)).toBe(
            'Auf grünen Auen läßt er mich lagern, zum Lagerplatz am Bache führt er mich.',
        );
    });
});

describe('snippet', () => {
    it('cuts at a word and says so', () => {
        expect(snippet('Der HERR ist mein Hirt: mir mangelt nichts.', 20)).toBe(
            'Der HERR ist mein …',
        );
        expect(snippet('kurz', 20)).toBe('kurz');
    });
});
