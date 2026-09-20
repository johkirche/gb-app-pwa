import { describe, expect, it } from 'vitest';

import type { Song } from '@/db';
import {
    songMatchesTerms,
    songSearchRank,
    songVerseLines,
    songVerseSnippet,
} from '@/utils/songSearch';

// Nur die Felder, in denen die Suche nachsieht — der Rest des Liedes ändert an
// keinem Fall hier etwas und würde ihn nur zustellen.
function song(partial: Partial<Song> & { id: string }): Song {
    return {
        index: 0,
        titel: '',
        strophen: [],
        textAutoren: [],
        melodieAutoren: [],
        noten: [],
        notentextMxml: null,
        kategorien: [],
        ...partial,
    };
}

const LIED = song({
    id: '1',
    index: 12,
    titel: 'Bis hierher hat mich Gott gebracht',
    strophen: [
        { strophe: '1', text: 'Bis hierher hat mich Gott ge¬bracht\ndurch seine große Güte' },
        { strophe: '2', text: 'Bis hierher hat er Tag und Nacht\nbewahrt mein Herz und Gemüte' },
    ],
});

describe('Strophen als Suchfeld', () => {
    it('macht aus jeder Strophe eine Zeile, ohne den Trennstrich des Setzers', () => {
        expect(songVerseLines(LIED)).toEqual([
            { nummer: 1, text: 'Bis hierher hat mich Gott gebracht durch seine große Güte' },
            { nummer: 2, text: 'Bis hierher hat er Tag und Nacht bewahrt mein Herz und Gemüte' },
        ]);
    });

    it('zählt die Strophen durch, bevor eine leere herausfällt', () => {
        const mitLuecke = song({
            id: '2',
            strophen: [
                { strophe: '', text: '' },
                { strophe: '2', text: 'Zweite Strophe' },
            ],
        });
        expect(songVerseLines(mitLuecke)).toEqual([{ nummer: 2, text: 'Zweite Strophe' }]);
    });
});

describe('Suchbereich', () => {
    it('sieht im Titelbereich nicht in den Strophen nach', () => {
        expect(songMatchesTerms(LIED, ['gemute'])).toBe(false);
        expect(songMatchesTerms(LIED, ['gemute'], 'titel')).toBe(false);
    });

    it('findet die erinnerte Zeile, sobald der Text dazugehört', () => {
        expect(songMatchesTerms(LIED, ['gemute'], 'text')).toBe(true);
        // Gefaltet wie überall: „gute" findet „Güte", „grosse" findet „große".
        expect(songMatchesTerms(LIED, ['grosse', 'gute'], 'text')).toBe(true);
    });

    it('nimmt die Felder des Titelbereichs in den Textbereich mit', () => {
        expect(songMatchesTerms(LIED, ['hierher', '12'], 'text')).toBe(true);
    });
});

describe('Der Ausschnitt zur Trefferzeile', () => {
    it('nennt die Strophe, in der das Suchwort steht', () => {
        expect(songVerseSnippet(LIED, ['gemute'])).toEqual({
            nummer: 2,
            text: '…Tag und Nacht bewahrt mein Herz und Gemüte',
        });
    });

    it('nimmt die erste Strophe, in der überhaupt etwas steht', () => {
        expect(songVerseSnippet(LIED, ['hierher'])?.nummer).toBe(1);
    });

    it('nimmt die Strophe, in der die meisten Suchwörter beieinanderstehen', () => {
        // „hierher" steht in beiden Strophen, „gemute" nur in der zweiten —
        // die erste wäre die falsche Zeile zum Vorzeigen.
        expect(songVerseSnippet(LIED, ['hierher', 'gemute'])?.nummer).toBe(2);
    });

    it('gibt null, wo der Treffer nicht im Text sitzt — dann steht er im Titel', () => {
        expect(songVerseSnippet(LIED, ['12'])).toBeNull();
        expect(songVerseSnippet(LIED, [])).toBeNull();
    });
});

describe('Wie nah ein Lied an der Eingabe liegt', () => {
    const terms = ['bis', 'hierher', 'gebracht'];

    it('wertet das Lied höher, in dem die Zeile wirklich so dasteht', () => {
        const verstreut = song({
            id: '9',
            titel: 'Gebracht',
            strophen: [{ strophe: '1', text: 'Bis an das Ende, hierher und weiter' }],
        });

        expect(songSearchRank(LIED, terms, 'text')).toBeGreaterThan(
            songSearchRank(verstreut, terms, 'text'),
        );
    });

    it('nimmt das beste Feld, nicht das erste — ein Titel zählt wie eine Strophe', () => {
        // Im Titel steht „Bis hierher hat mich Gott gebracht"; „bis hierher"
        // hängt dort zusammen, in keiner Strophe länger.
        expect(songSearchRank(LIED, ['bis', 'hierher'], 'titel')).toBe(11);
    });

    it('bleibt bei null, wo die Eingabe nicht vorkommt', () => {
        expect(songSearchRank(LIED, ['halleluja'], 'text')).toBe(0);
    });
});
