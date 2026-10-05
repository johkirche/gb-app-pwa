import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    BIBEL_BOOKS,
    BIBEL_TRANSLATION,
    BIBEL_TRANSLATIONS,
    bookUrl,
    chapterLabel,
    chapterPath,
    findBook,
    loadBook,
    neighbours,
} from './bibel';

describe('the book list', () => {
    it('carries the 66 books of the Protestant canon, in order', () => {
        expect(BIBEL_BOOKS).toHaveLength(66);
        expect(BIBEL_BOOKS[0].name).toBe('1. Mose');
        expect(BIBEL_BOOKS[39].name).toBe('Matthäus');
        expect(BIBEL_BOOKS[65].name).toBe('Offenbarung');
    });

    it('knows how many chapters a book has', () => {
        expect(findBook('psalm')?.chapters).toBe(150);
        expect(findBook('judas')?.chapters).toBe(1);
    });
});

describe('neighbours', () => {
    it('steps within a book', () => {
        expect(neighbours('matthaeus', 21)).toEqual({
            prev: { slug: 'matthaeus', chapter: 20 },
            next: { slug: 'matthaeus', chapter: 22 },
        });
    });

    it('crosses into the next and previous book', () => {
        expect(neighbours('maleachi', 3).next).toEqual({ slug: 'matthaeus', chapter: 1 });
        expect(neighbours('matthaeus', 1).prev).toEqual({ slug: 'maleachi', chapter: 3 });
    });

    it('stops at either end of the Bible', () => {
        expect(neighbours('1-mose', 1).prev).toBeNull();
        expect(neighbours('offenbarung', 22).next).toBeNull();
    });
});

describe('labels and paths', () => {
    it('names the chapter, except in one-chapter books', () => {
        expect(chapterLabel({ slug: 'psalm', chapter: 23 })).toBe('Psalm 23');
        expect(chapterLabel({ slug: 'judas', chapter: 1 })).toBe('Judas');
    });

    it('points at a verse when given one', () => {
        expect(chapterPath({ slug: 'psalm', chapter: 23 }, 4)).toBe('/bibel/psalm/23?vers=4');
    });
});

describe('translations', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('knows Menge and the Lutherbibel 1912, Menge by the book list’s name', () => {
        expect(BIBEL_TRANSLATIONS.menge.label).toBe(BIBEL_TRANSLATION);
        expect(BIBEL_TRANSLATIONS.luther1912).toMatchObject({
            label: 'Lutherbibel (1912)',
            short: 'Luther',
        });
    });

    it('fetches a book from its translation’s folder, Menge unless told otherwise', () => {
        expect(bookUrl('joel')).toBe('/bibeltext/menge/joel.json');
        expect(bookUrl('joel', 'luther1912')).toBe('/bibeltext/luther1912/joel.json');
    });

    it('keeps the two translations of a book apart', async () => {
        const fetched: string[] = [];
        vi.stubGlobal('fetch', async (url: string) => {
            fetched.push(url);
            return new Response(JSON.stringify({ chapters: [[{ h: 2, t: url }]] }));
        });

        const menge = await loadBook('obadja');
        const luther = await loadBook('obadja', 'luther1912');
        await loadBook('obadja', 'luther1912');

        expect(fetched).toEqual([
            '/bibeltext/menge/obadja.json',
            '/bibeltext/luther1912/obadja.json',
        ]);
        expect(menge).not.toEqual(luther);
    });

    it('tries a failed book again next time', async () => {
        let calls = 0;
        vi.stubGlobal('fetch', async () => {
            calls += 1;
            return calls === 1
                ? new Response('', { status: 503 })
                : new Response(JSON.stringify({ chapters: [] }));
        });

        await expect(loadBook('haggai', 'luther1912')).rejects.toThrow('HTTP 503');
        await expect(loadBook('haggai', 'luther1912')).resolves.toEqual([]);
    });
});
