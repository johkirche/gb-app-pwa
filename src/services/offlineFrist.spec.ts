import { describe, expect, it } from 'vitest';

import { NACHFRIST_TAGE, VORWARNUNG_TAGE, fristHinweis, offlineFrist } from './offlineFrist';

/**
 * How long the book keeps opening without the server: the session's thirty
 * days, a reminder in the last week of them, and a grace after them for a
 * device that is still offline.
 */

const DAY = 24 * 60 * 60 * 1000;
const END = Date.UTC(2026, 11, 17, 12);

describe('offlineFrist', () => {
    it('has nothing to say about a session with time left, or none known', () => {
        expect(offlineFrist(END, END - (VORWARNUNG_TAGE + 1) * DAY)).toEqual({ state: 'ok' });
        expect(offlineFrist(undefined, END)).toEqual({ state: 'ok' });
    });

    it('reminds in the last week of the session', () => {
        expect(offlineFrist(END, END - VORWARNUNG_TAGE * DAY)).toMatchObject({ state: 'bald' });
        expect(offlineFrist(END, END - 1)).toMatchObject({ state: 'bald', sessionEnd: END });
    });

    it('keeps the book open offline for the grace after the session', () => {
        const lockAt = END + NACHFRIST_TAGE * DAY;
        expect(offlineFrist(END, END)).toEqual({ state: 'nachfrist', sessionEnd: END, lockAt });
        expect(offlineFrist(END, lockAt - 1)).toMatchObject({ state: 'nachfrist' });
    });

    it('closes it once the grace is over too', () => {
        expect(offlineFrist(END, END + NACHFRIST_TAGE * DAY)).toEqual({ state: 'vorbei' });
    });
});

describe('fristHinweis', () => {
    it('names the day a connection still renews the session', () => {
        const hint = fristHinweis(offlineFrist(END, END - DAY));
        expect(hint?.description).toMatch(/bis zum 17\. Dezember einmal mit Internetverbindung/);
    });

    it('names the day the book stops opening offline', () => {
        const hint = fristHinweis(offlineFrist(END, END + DAY));
        expect(hint?.description).toMatch(/noch bis zum 31\. Dezember darin lesen/);
    });

    it('says nothing when there is nothing to say', () => {
        expect(fristHinweis({ state: 'ok' })).toBeNull();
        expect(fristHinweis({ state: 'vorbei' })).toBeNull();
    });
});
