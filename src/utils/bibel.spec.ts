import { describe, expect, it } from 'vitest';

import { BIBEL_BOOKS, chapterLabel, chapterPath, findBook, neighbours } from './bibel';

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
