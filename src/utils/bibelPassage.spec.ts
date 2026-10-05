import { describe, expect, it } from 'vitest';

import {
    passageKey,
    passageLabel,
    passagePath,
    passagesFromVerses,
    reorderPassages,
    toPassage,
    toPassages,
    withPassage,
    withoutPassage,
} from '@/utils/bibelPassage';

const ROEMER = { slug: 'roemer', chapter: 8, verse: 28, endVerse: 30 };
const PSALM = { slug: 'psalm', chapter: 23 };
const JUDAS = { slug: 'judas', chapter: 1, verse: 3 };

describe('passageLabel', () => {
    it('writes a passage the way the book is quoted', () => {
        expect(passageLabel(ROEMER)).toBe('Römer 8,28-30');
        expect(passageLabel(PSALM)).toBe('Psalm 23');
        expect(passageLabel({ slug: 'johannes', chapter: 3, verse: 16 })).toBe('Johannes 3,16');
    });

    it('leaves out the chapter of a one-chapter book', () => {
        expect(passageLabel(JUDAS)).toBe('Judas 3');
    });

    it('is empty for a book it does not know', () => {
        expect(passageLabel({ slug: 'gibtsnicht', chapter: 1 })).toBe('');
    });
});

describe('passagePath', () => {
    it('opens the chapter at the first verse', () => {
        expect(passagePath(ROEMER)).toBe('/bibel/roemer/8?vers=28');
        expect(passagePath(PSALM)).toBe('/bibel/psalm/23');
    });
});

describe('toPassage', () => {
    it('keeps only the passage’s own fields', () => {
        expect(toPassage({ ...ROEMER, extra: 1 })).toEqual(ROEMER);
    });

    it('rejects what the Bible does not have', () => {
        expect(toPassage({ slug: 'psalm', chapter: 151 })).toBeNull();
        expect(toPassage({ slug: 'gibtsnicht', chapter: 1 })).toBeNull();
        expect(toPassage({ slug: 'psalm', chapter: 0 })).toBeNull();
        expect(toPassage('Psalm 23')).toBeNull();
        expect(toPassage(null)).toBeNull();
    });

    it('drops an end verse that does not come after the first', () => {
        expect(toPassage({ slug: 'psalm', chapter: 23, verse: 4, endVerse: 4 })).toEqual({
            slug: 'psalm',
            chapter: 23,
            verse: 4,
        });
    });
});

describe('toPassages', () => {
    it('treats a missing list as an empty one', () => {
        expect(toPassages(undefined)).toEqual([]);
        expect(toPassages([PSALM, 'x'])).toEqual([PSALM]);
    });
});

describe('withPassage / withoutPassage', () => {
    it('appends a passage once', () => {
        const once = withPassage(undefined, ROEMER);
        expect(once).toEqual([ROEMER]);
        expect(withPassage(once, { ...ROEMER })).toEqual([ROEMER]);
        expect(withPassage(once, PSALM)).toEqual([ROEMER, PSALM]);
    });

    it('tells a range from its first verse', () => {
        expect(withPassage([ROEMER], { slug: 'roemer', chapter: 8, verse: 28 })).toHaveLength(2);
    });

    it('removes by key', () => {
        expect(withoutPassage([ROEMER, PSALM], passageKey(ROEMER))).toEqual([PSALM]);
    });
});

describe('reorderPassages', () => {
    it('follows the given order and keeps what it was not given', () => {
        const list = [ROEMER, PSALM, JUDAS];
        expect(reorderPassages(list, [passageKey(JUDAS), passageKey(ROEMER)])).toEqual([
            JUDAS,
            ROEMER,
            PSALM,
        ]);
    });

    it('cannot duplicate a passage', () => {
        expect(reorderPassages([PSALM], [passageKey(PSALM), passageKey(PSALM)])).toEqual([PSALM]);
    });
});

describe('passagesFromVerses', () => {
    const psalm = { slug: 'psalm', chapter: 23 };

    it('makes one passage of an unbroken run', () => {
        expect(passagesFromVerses(psalm, [3, 1, 2])).toEqual([
            { slug: 'psalm', chapter: 23, verse: 1, endVerse: 3 },
        ]);
    });

    it('splits where the run breaks, and keeps a lone verse bare', () => {
        expect(passagesFromVerses(psalm, [1, 2, 5])).toEqual([
            { slug: 'psalm', chapter: 23, verse: 1, endVerse: 2 },
            { slug: 'psalm', chapter: 23, verse: 5 },
        ]);
    });
});
