import { describe, expect, it } from 'vitest';

import { fitActions } from './verseActions';

describe('fitActions', () => {
    it('puts everything in the bar while it fits', () => {
        expect(fitActions(['a', 'b', 'c', 'd', 'e'])).toEqual({
            inBar: ['a', 'b', 'c', 'd', 'e'],
            more: [],
        });
    });

    it('keeps the first four past five, and hands the rest to "Mehr"', () => {
        expect(fitActions(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual({
            inBar: ['a', 'b', 'c', 'd'],
            more: ['e', 'f', 'g'],
        });
    });
});
