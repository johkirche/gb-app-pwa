import { describe, expect, it } from 'vitest';

import {
    REPEAT_ENDLESS,
    REPEAT_MAX,
    REPEAT_ONCE,
    clampRepeat,
    isEndless,
    proposedRepeat,
    repeatBadge,
    repeatLabel,
} from './playbackRepeat';

describe('clampRepeat', () => {
    it('keeps a count inside what the panel counts to', () => {
        expect(clampRepeat(0)).toBe(REPEAT_ONCE);
        expect(clampRepeat(-3)).toBe(REPEAT_ONCE);
        expect(clampRepeat(99)).toBe(REPEAT_MAX);
        expect(clampRepeat(4)).toBe(4);
    });

    it('leaves endless as it is', () => {
        expect(clampRepeat(REPEAT_ENDLESS)).toBe(REPEAT_ENDLESS);
        expect(isEndless(clampRepeat(REPEAT_ENDLESS))).toBe(true);
    });

    it('answers one pass for a count that is no number', () => {
        expect(clampRepeat(Number.NaN)).toBe(REPEAT_ONCE);
    });
});

describe('repeatBadge', () => {
    // One pass is what the icon alone already means.
    it('says nothing where the song is played once', () => {
        expect(repeatBadge(REPEAT_ONCE)).toBe('');
    });

    it('counts the passes', () => {
        expect(repeatBadge(4)).toBe('4×');
        expect(repeatBadge(REPEAT_ENDLESS)).toBe('∞');
    });
});

describe('repeatLabel', () => {
    it('says the whole state in words', () => {
        expect(repeatLabel(REPEAT_ONCE)).toBe('Einmal spielen');
        expect(repeatLabel(3)).toBe('3× spielen');
        expect(repeatLabel(REPEAT_ENDLESS)).toBe('Endlos wiederholen');
    });
});

describe('proposedRepeat', () => {
    // The verses are the reason anyone repeats a hymn at all.
    it('proposes one pass per verse', () => {
        expect(proposedRepeat(4)).toBe(4);
        expect(proposedRepeat(7)).toBe(7);
    });

    it('proposes a second pass where the verses cannot say', () => {
        expect(proposedRepeat(0)).toBe(2);
        expect(proposedRepeat(1)).toBe(2);
    });

    it('proposes no more than the panel counts to', () => {
        expect(proposedRepeat(40)).toBe(REPEAT_MAX);
    });
});
