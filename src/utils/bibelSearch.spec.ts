import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Block } from './bibel';
import { layoutChapter, verseText, versesOf } from './bibelLayout';
import { parseReference } from './bibelRef';
import {
    type IndexedVerse,
    chapterVerses,
    inScope,
    indexBook,
    referenceLabel,
    scopeLabel,
    searchVerses,
} from './bibelSearch';
import { highlightParts, searchTerms } from './search';

// The shipped text, not a stand-in: the search has to work on what the build
// actually writes, footnotes and poetry lines included.
function shippedBook(slug: string): Block[][] {
    const path = resolve(__dirname, '../../public/bibeltext/menge', `${slug}.json`);
    return (JSON.parse(readFileSync(path, 'utf8')) as { chapters: Block[][] }).chapters;
}

const johannes = indexBook('johannes', shippedBook('johannes'));
const psalmen = indexBook('psalm', shippedBook('psalm'));
const rut = indexBook('rut', shippedBook('rut'));
// Canonical order, as the index hands them over.
const all: IndexedVerse[] = [...rut, ...psalmen, ...johannes];

function search(query: string, scope = 'all', limit = 200) {
    return searchVerses(all, searchTerms(query), scope, limit);
}

describe('chapterVerses', () => {
    it('gives every verse the same text verseText gives, in one pass', () => {
        // Psalm 119: long, poetic, and full of lines that carry on a verse.
        const blocks = shippedBook('psalm')[118];
        const laid = layoutChapter(blocks);
        const verses = chapterVerses(blocks);
        expect(verses.map((v) => v.verse)).toEqual(versesOf(laid));
        for (const { verse, text } of verses) expect(text).toBe(verseText(laid, verse));
    });

    it('leaves out footnotes and joins poetry lines with a space', () => {
        const blocks: Block[] = [
            {
                p: [
                    {
                        s: [
                            { v: 2 },
                            'Auf grünen Auen',
                            { n: 'oder: Weiden' },
                            ' läßt er mich lagern,',
                        ],
                    },
                    { s: ['zum Lagerplatz am Bache führt er mich.'], i: 2 },
                ],
                q: 1,
            },
        ];
        expect(chapterVerses(blocks)).toEqual([
            {
                verse: 2,
                text: 'Auf grünen Auen läßt er mich lagern, zum Lagerplatz am Bache führt er mich.',
            },
        ]);
    });
});

describe('indexBook', () => {
    it('numbers chapters from 1 and keeps a folded copy', () => {
        const verse = johannes.find((v) => v.chapter === 3 && v.verse === 16);
        expect(verse?.text).toMatch(/^Denn so sehr hat Gott die Welt geliebt/);
        expect(verse?.folded).not.toMatch(/[A-ZÄÖÜß,.]/);
    });
});

describe('searchVerses', () => {
    it('finds a verse when every word occurs in it, in any order', () => {
        const hits = search('welt geliebt gott').groups.flatMap((g) => g.verses);
        expect(hits.map((v) => `${v.chapter},${v.verse}`)).toContain('3,16');
    });

    it('wants all the words, not any of them', () => {
        expect(search('Hirte').total).toBeGreaterThan(search('Hirte Schafe').total);
        expect(search('Hirte xyzzy').total).toBe(0);
    });

    it('ignores case, umlauts and ß', () => {
        // Psalm 23,2 reads "Auf grünen Auen".
        expect(search('GRUNEN auen').total).toBe(search('grünen Auen').total);
        expect(search('grunen auen').total).toBeGreaterThan(0);
        expect(search('grosse').total).toBe(search('große').total);
    });

    it('groups by book in canonical order, with counts', () => {
        const { groups, total } = search('Herr');
        expect(groups.map((g) => g.book.slug)).toEqual(['rut', 'psalm', 'johannes']);
        expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(total);
    });

    it('counts every hit but carries only the first ones', () => {
        const result = search('Herr', 'all', 50);
        expect(result.shown).toBe(50);
        expect(result.total).toBeGreaterThan(50);
        // Rut fills part of the cap, Psalms the rest; John is past it but
        // still listed with its count.
        const john = result.groups.find((g) => g.book.slug === 'johannes');
        expect(john?.verses).toEqual([]);
        expect(john?.count).toBeGreaterThan(0);
    });

    it('keeps to a Testament or a single book', () => {
        expect(search('Herr', 'NT').groups.map((g) => g.book.slug)).toEqual(['johannes']);
        expect(search('Herr', 'AT').groups.map((g) => g.book.slug)).toEqual(['rut', 'psalm']);
        expect(search('Herr', 'rut').groups.map((g) => g.book.slug)).toEqual(['rut']);
    });

    it('finds nothing without a word to look for', () => {
        expect(search('  ').total).toBe(0);
        expect(search(' - ').groups).toEqual([]);
    });
});

describe('scopes', () => {
    it('places books in their Testament', () => {
        const ps = { slug: 'psalm', testament: 'AT' } as never;
        expect(inScope(ps, 'all')).toBe(true);
        expect(inScope(ps, 'AT')).toBe(true);
        expect(inScope(ps, 'NT')).toBe(false);
        expect(inScope(ps, 'psalm')).toBe(true);
        expect(inScope(ps, 'johannes')).toBe(false);
    });

    it('names them', () => {
        expect(scopeLabel('all')).toBe('Ganze Bibel');
        expect(scopeLabel('NT')).toBe('Neues Testament');
        expect(scopeLabel('roemer')).toBe('Römer');
    });
});

describe('referenceLabel', () => {
    it('writes a reference the way the reader typed it, in full', () => {
        expect(referenceLabel(parseReference('joh 3,16')!)).toBe('Johannes 3,16');
        expect(referenceLabel(parseReference('1. Mose 1,1-3')!)).toBe('1. Mose 1,1-3');
        expect(referenceLabel(parseReference('ps 23')!)).toBe('Psalm 23');
        expect(referenceLabel(parseReference('Judas 3')!)).toBe('Judas 3');
    });
});

describe('highlighting a verse', () => {
    it('marks the words in the text as written, umlauts and all', () => {
        const parts = highlightParts(
            'Auf grünen Auen läßt er mich lagern',
            searchTerms('grunen lasst'),
        );
        expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(['grünen', 'läßt']);
    });
});
