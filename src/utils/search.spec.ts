import { describe, expect, it } from 'vitest';

import {
    foldForSearch,
    highlightParts,
    longestRun,
    matchesTerms,
    searchTerms,
    snippetAround,
} from '@/utils/search';

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

describe('Ausschnitt um den Treffer', () => {
    const ZEILE =
        'Bis hierher hat mich Gott gebracht durch seine große Güte, bis hierher hat er Tag und Nacht bewahrt mein Herz und Gemüte';

    it('schneidet an Wortgrenzen und sagt mit … an, wo etwas fehlt', () => {
        const snippet = snippetAround(ZEILE, ['gute']);
        expect(snippet).toBe(
            '…mich Gott gebracht durch seine große Güte, bis hierher hat er Tag und Nacht…',
        );
    });

    it('lässt das … weg, wo der Text selbst anfängt oder aufhört', () => {
        expect(snippetAround('Bis hierher hat mich Gott gebracht', ['hierher'])).toBe(
            'Bis hierher hat mich Gott gebracht',
        );
    });

    it('nimmt die Stelle, an der die Suchwörter zusammenstehen', () => {
        // „hierher" steht zweimal in der Zeile. Gezeigt wird das zweite, weil
        // dort auch „nacht" liegt — die Stelle, nach der gefragt war.
        expect(snippetAround(ZEILE, ['nacht', 'hierher'])).toBe(
            '…seine große Güte, bis hierher hat er Tag und Nacht bewahrt mein Herz und…',
        );
    });

    it('findet den Treffer auch über die Faltung — und schneidet im Original', () => {
        // „gemute" ist ein Zeichen kürzer als „Gemüte"; ohne Rückrechnung läge
        // der Schnitt daneben.
        expect(snippetAround(ZEILE, ['gemute'])).toMatch(/Gemüte$/);
    });

    it('gibt null, wo kein Suchwort steht', () => {
        expect(snippetAround(ZEILE, ['halleluja'])).toBeNull();
        expect(snippetAround(ZEILE, [])).toBeNull();
        expect(snippetAround('', ['gott'])).toBeNull();
    });
});

describe('Kurze Suchwörter', () => {
    const felder = ['ach lasst doch eure kinderherzen', 'vertrauen glaubenstreue nachfolge'];

    it('zählen nur am Wortanfang — „er" steckt sonst in „Vertrauen"', () => {
        expect(matchesTerms(['er'], felder)).toBe(false);
        expect(matchesTerms(['sol'], ['im herzen sollt ihr flehn'])).toBe(true);
    });

    it('lassen lange Suchwörter mitten im Wort, wo das Deutsche sie braucht', () => {
        expect(matchesTerms(['herzen'], felder)).toBe(true);
    });

    it('markieren, was sie auch gefunden haben, und nichts sonst', () => {
        const marked = (text: string, terms: string[]) =>
            highlightParts(text, terms)
                .filter((part) => part.match)
                .map((part) => part.text);

        expect(marked('Vertrauen, Glaubenstreue', ['er'])).toEqual([]);
        expect(marked('Ach lasst doch eure Kinderherzen', ['herzen'])).toEqual(['herzen']);
    });
});

describe('Der längste ununterbrochene Zug', () => {
    const TERMS = searchTerms('soll er drin im Herzen bleiben');

    it('misst die eingetippte Zeile, wo sie wirklich so dasteht', () => {
        const zeile = foldForSearch('Und soll er drin im Herzen bleiben, dann macht es rein');
        // „soll er drin im herzen bleiben" — 30 Zeichen am Stück.
        expect(longestRun(zeile, TERMS)).toBe(30);
    });

    it('misst nur das Stück, wo die Wörter auseinanderliegen', () => {
        const zeile = foldForSearch('Im Herzen sollt ihr flehn und beten, wenn eure Sehnsucht');
        // „im herzen soll" — bis „sollt" reicht es, dann bricht das t den Zug ab.
        // Kürzer als die Zeile selbst, und genau darum steht sie weiter unten.
        expect(longestRun(zeile, TERMS)).toBe(14);
    });

    it('zählt ein Wort, das nur zur Hälfte getroffen ist, nur zur Hälfte', () => {
        // „soll" steckt in „sollt", aber das „t" bricht den Zug ab.
        expect(longestRun(foldForSearch('ihr sollt beten'), ['soll'])).toBe(4);
    });

    it('bleibt bei null, wo nichts steht', () => {
        expect(longestRun(foldForSearch('Lobet den Herren'), TERMS)).toBe(0);
        expect(longestRun('', TERMS)).toBe(0);
    });
});
