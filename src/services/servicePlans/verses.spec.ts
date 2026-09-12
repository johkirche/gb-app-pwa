import { describe, expect, it } from 'vitest';

import {
    allVerseNumbers,
    formatVerseNumbers,
    formatVerseSelection,
    isVerseSung,
    normalizeVerseSelection,
} from './verses';

describe('allVerseNumbers', () => {
    it('numbers the verses the way the page does', () => {
        expect(allVerseNumbers(3)).toEqual([1, 2, 3]);
        expect(allVerseNumbers(0)).toEqual([]);
        expect(allVerseNumbers(-1)).toEqual([]);
    });
});

describe('normalizeVerseSelection', () => {
    it('sorts and de-duplicates whatever it is handed', () => {
        expect(normalizeVerseSelection([3, 1, 3], 5)).toEqual([1, 3]);
        expect(normalizeVerseSelection(new Set([2, 1]), 5)).toEqual([1, 2]);
    });

    it('is null for the whole hymn, however that is said', () => {
        expect(normalizeVerseSelection(null)).toBeNull();
        expect(normalizeVerseSelection(undefined)).toBeNull();
        // An empty selection would be a song nobody sings — that is not a
        // selection, it is the absence of one.
        expect(normalizeVerseSelection([], 4)).toBeNull();
        expect(normalizeVerseSelection([1, 2, 3], 3)).toBeNull();
    });

    it('drops verses the hymn does not have', () => {
        expect(normalizeVerseSelection([0, 1, 2, 9], 4)).toEqual([1, 2]);
        expect(normalizeVerseSelection([1.5, Number.NaN, 2], 4)).toEqual([2]);
    });

    it('leaves a selection alone where the hymn is not on this device', () => {
        // Without a count there is nothing to clamp against, and cleaning the
        // selection away against a count of zero would lose the reader's choice
        // for a song that simply has not been synced yet.
        expect(normalizeVerseSelection([2, 4])).toEqual([2, 4]);
    });
});

describe('isVerseSung', () => {
    it('sings everything when nothing was chosen', () => {
        expect(isVerseSung(null, 1)).toBe(true);
        expect(isVerseSung(undefined, 7)).toBe(true);
    });

    it('sings only what was chosen', () => {
        expect(isVerseSung([1, 3], 1)).toBe(true);
        expect(isVerseSung([1, 3], 2)).toBe(false);
    });
});

describe('formatVerseNumbers', () => {
    it('writes a run as a range', () => {
        expect(formatVerseNumbers([1, 2, 3])).toBe('1–3');
        expect(formatVerseNumbers([1, 2, 3, 5])).toBe('1–3 und 5');
        expect(formatVerseNumbers([1, 2, 3, 5, 6, 7])).toBe('1–3 und 5–7');
    });

    it('writes out a pair rather than spanning it', () => {
        expect(formatVerseNumbers([1, 2])).toBe('1, 2');
        expect(formatVerseNumbers([1, 2, 4])).toBe('1, 2 und 4');
    });

    it('separates single verses', () => {
        expect(formatVerseNumbers([3])).toBe('3');
        expect(formatVerseNumbers([2, 4, 6])).toBe('2, 4 und 6');
        expect(formatVerseNumbers([])).toBe('');
    });
});

describe('formatVerseSelection', () => {
    it('names the whole hymn as such', () => {
        expect(formatVerseSelection(null)).toBe('Alle Strophen');
        expect(formatVerseSelection([1, 2, 3], 3)).toBe('Alle Strophen');
    });

    it('counts the verses, not the ranges', () => {
        expect(formatVerseSelection([3], 5)).toBe('Strophe 3');
        expect(formatVerseSelection([1, 2, 3], 7)).toBe('Strophen 1–3');
        expect(formatVerseSelection([1, 2, 4], 7)).toBe('Strophen 1, 2 und 4');
    });
});
