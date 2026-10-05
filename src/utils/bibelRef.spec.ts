import { describe, expect, it } from 'vitest';

import { findBookByName, findReferences, parseReference } from './bibelRef';

describe('parseReference', () => {
    it.each([
        ['Joh 3,16', { slug: 'johannes', chapter: 3, verse: 16 }],
        ['Joh 3:16', { slug: 'johannes', chapter: 3, verse: 16 }],
        ['1. Mose 1,1-3', { slug: '1-mose', chapter: 1, verse: 1, endVerse: 3 }],
        ['1Kor 13', { slug: '1-korinther', chapter: 13 }],
        ['Ps 23', { slug: 'psalm', chapter: 23 }],
        ['psalm23', { slug: 'psalm', chapter: 23 }],
        ['Römer 8,28', { slug: 'roemer', chapter: 8, verse: 28 }],
        ['Gen 12,3', { slug: '1-mose', chapter: 12, verse: 3 }],
        ['Offb 22', { slug: 'offenbarung', chapter: 22 }],
        ['2.Kön 5,1', { slug: '2-koenige', chapter: 5, verse: 1 }],
    ])('reads %s', (input, expected) => {
        expect(parseReference(input)).toEqual(expected);
    });

    it('reads a bare number in a one-chapter book as the verse', () => {
        expect(parseReference('Judas 3')).toEqual({ slug: 'judas', chapter: 1, verse: 3 });
    });

    it('turns down what is no reference, or a chapter the book does not have', () => {
        expect(parseReference('Hirte')).toBeNull();
        expect(parseReference('Ps 151')).toBeNull();
        expect(parseReference('Xyz 1,1')).toBeNull();
    });
});

describe('findBookByName', () => {
    it('takes an unambiguous start of a name', () => {
        expect(findBookByName('Offenba')?.slug).toBe('offenbarung');
    });

    it('declines a start two books share', () => {
        expect(findBookByName('Joh')?.slug).toBe('johannes'); // an alias, so exact
        expect(findBookByName('Ha')).toBeUndefined();
    });
});

describe('findReferences', () => {
    it('finds each reference in a footnote', () => {
        const text = 'vgl. Ps 130,8; Jes 7,14';
        const found = findReferences(text);
        expect(found.map((f) => text.slice(f.start, f.end))).toEqual(['Ps 130,8', 'Jes 7,14']);
        expect(found[1].ref).toEqual({ slug: 'jesaja', chapter: 7, verse: 14 });
    });

    it('leaves ordinary words alone', () => {
        expect(findReferences('= dem Urmeer')).toEqual([]);
        expect(findReferences('oder: Glück und Gnade')).toEqual([]);
    });
});
