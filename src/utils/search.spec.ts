import { describe, expect, it } from 'vitest';

import { foldForSearch, highlightParts, matchesTerms, searchTerms } from '@/utils/search';

describe('Faltung', () => {
    it('nimmt Groß-/Kleinschreibung, Umlautpunkte und ß aus dem Vergleich', () => {
        expect(foldForSearch('Großer Gott')).toBe('grosser gott');
        expect(foldForSearch('Über allen Höhen')).toBe('uber allen hohen');
        expect(foldForSearch('Ça ira')).toBe('ca ira');
    });

    it('wirft die Satzzeichen weg, an denen Titel und Eingabe sich unterscheiden', () => {
        expect(foldForSearch("Wie schön leucht't uns")).toBe('wie schon leuchtt uns');
        expect(foldForSearch('Herz-Jesu, o Herr!')).toBe('herzjesu o herr');
    });
});

describe('Suchwörter', () => {
    it('trennt an Leerzeichen, faltet und wirft Dubletten weg', () => {
        expect(searchTerms('  Großer   GOTT gott ')).toEqual(['grosser', 'gott']);
    });

    it('lässt nichts übrig, wo nach der Faltung nichts steht', () => {
        expect(searchTerms('')).toEqual([]);
        expect(searchTerms('  -  ')).toEqual([]);
    });
});

describe('Treffer über mehrere Felder', () => {
    const fields = ['lobet den herren', '317', 'martin luther'];

    it('verknüpft die Wörter mit UND, die Felder mit ODER', () => {
        expect(matchesTerms(['luther', '317'], fields)).toBe(true);
        expect(matchesTerms(['luther', '318'], fields)).toBe(false);
    });

    it('trifft auch mitten im Wort', () => {
        expect(matchesTerms(['herr'], fields)).toBe(true);
    });

    it('nimmt ohne Suchwort alles', () => {
        expect(matchesTerms([], fields)).toBe(true);
    });
});

describe('Markierung', () => {
    it('lässt einen Text ohne Suchwort und ohne Treffer in einem Stück', () => {
        expect(highlightParts('Lobet den Herren', [])).toEqual([
            { text: 'Lobet den Herren', match: false },
        ]);
        expect(highlightParts('Lobet den Herren', ['bach'])).toEqual([
            { text: 'Lobet den Herren', match: false },
        ]);
        expect(highlightParts('', ['bach'])).toEqual([]);
    });

    it('markiert jedes Suchwort, an jeder Stelle', () => {
        expect(highlightParts('Lobet den Herren', ['lobet', 'herr'])).toEqual([
            { text: 'Lobet', match: true },
            { text: ' den ', match: false },
            { text: 'Herr', match: true },
            { text: 'en', match: false },
        ]);
    });

    // Der eigentliche Grund für die Rückrechnung: „grosser" ist ein Zeichen
    // länger als „Großer", eine Markierung nach der gefalteten Länge läge daneben.
    it('rechnet die Stellen in den ungefalteten Text zurück', () => {
        expect(highlightParts('Großer Gott', ['grosser'])).toEqual([
            { text: 'Großer', match: true },
            { text: ' Gott', match: false },
        ]);
        expect(highlightParts('Über allen Höhen', ['hohen'])).toEqual([
            { text: 'Über allen ', match: false },
            { text: 'Höhen', match: true },
        ]);
    });

    // Weggefaltete Satzzeichen liegen mitten im Treffer und werden mitmarkiert —
    // dazwischen aufzuhören sähe aus wie ein Fehler.
    it('markiert über weggefaltete Zeichen hinweg', () => {
        expect(highlightParts("leucht't uns", ['leuchtt'])).toEqual([
            { text: "leucht't", match: true },
            { text: ' uns', match: false },
        ]);
    });

    it('zieht überlappende Treffer zu einem Stück zusammen', () => {
        expect(highlightParts('Gottes Sohn', ['gott', 'gottes'])).toEqual([
            { text: 'Gottes', match: true },
            { text: ' Sohn', match: false },
        ]);
    });

    it('markiert dasselbe Wort auch zweimal', () => {
        expect(highlightParts('Gott ist Gott', ['gott'])).toEqual([
            { text: 'Gott', match: true },
            { text: ' ist ', match: false },
            { text: 'Gott', match: true },
        ]);
    });
});
