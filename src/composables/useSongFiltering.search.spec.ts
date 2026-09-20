import { ref } from 'vue';

import { describe, expect, it } from 'vitest';

import { useSongFiltering } from '@/composables/useSongFiltering';

import type { Song } from '@/db';

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

// Zwei Lieder desselben Autors, eines mit Umlaut und Satzzeichen im Titel.
const LIEDER = [
    song({
        id: '10',
        index: 45,
        titel: 'Ein feste Burg ist unser Gott',
        textAutoren: [{ vorname: 'Martin', nachname: 'Luther' }],
        kategorien: [{ index: '1', name: 'Vertrauen' }],
    }),
    song({
        id: '11',
        index: 46,
        titel: 'Aus tiefer Not schrei ich zu dir',
        textAutoren: [{ vorname: 'Martin', nachname: 'Luther' }],
    }),
    song({
        id: '12',
        index: 47,
        titel: "Wie schön leucht't uns der Morgenstern",
        melodieAutoren: [{ vorname: 'Philipp', nachname: 'Nicolai' }],
        strophen: [
            { strophe: '1', text: 'Wie schön leuchtet der Morgenstern\nvoll Gnad und Wahrheit' },
            { strophe: '2', text: 'Du Sohn Davids aus Jakobs Stamm' },
        ],
    }),
];

// Eine frische Filterung je Fall — der Zustand gehört zur Liste, nicht zur Datei.
function suche(query: string) {
    const filtering = useSongFiltering(ref(LIEDER));
    filtering.setSearchQuery(query);
    return filtering;
}

describe('Suche', () => {
    it('verknüpft die Wörter der Eingabe mit UND', () => {
        expect(suche('feste burg').filteredSongs.value.map((s) => s.id)).toEqual(['10']);
        // Beide Wörter kommen vor, aber nicht in demselben Lied.
        expect(suche('feste not').filteredSongs.value).toEqual([]);
    });

    it('lässt die Wörter über verschiedene Felder gehen', () => {
        // Autor aus dem einen Feld, Liednummer aus dem anderen.
        expect(suche('luther 46').filteredSongs.value.map((s) => s.id)).toEqual(['11']);
        expect(suche('luther vertrauen').filteredSongs.value.map((s) => s.id)).toEqual(['10']);
    });

    it('achtet nicht auf Reihenfolge, Groß-/Kleinschreibung und Umlaute', () => {
        expect(suche('BURG feste').filteredSongs.value.map((s) => s.id)).toEqual(['10']);
        expect(suche('schon morgenstern').filteredSongs.value.map((s) => s.id)).toEqual(['12']);
    });

    it('findet den Autor über den ganzen Namen', () => {
        expect(suche('martin luther').filteredSongs.value.map((s) => s.id)).toEqual(['10', '11']);
    });

    it('stolpert nicht über Satzzeichen im Titel', () => {
        expect(suche('leuchtt').filteredSongs.value.map((s) => s.id)).toEqual(['12']);
    });

    it('gibt die Suchwörter für die Markierung in der Liste heraus', () => {
        const { activeSearchTerms, isSearchActive } = suche('Feste  BURG');
        expect(activeSearchTerms.value).toEqual(['feste', 'burg']);
        expect(isSearchActive.value).toBe(true);
    });

    it('sucht nicht, wo nach der Faltung kein Wort übrig bleibt', () => {
        const { filteredSongs, isSearchActive } = suche('  -  ');
        expect(isSearchActive.value).toBe(false);
        expect(filteredSongs.value).toHaveLength(LIEDER.length);
    });
});

describe('Suchbereich', () => {
    it('findet die erinnerte Zeile, ohne dass jemand etwas umlegen muss', () => {
        expect(suche('wahrheit').filteredSongs.value.map((s) => s.id)).toEqual(['12']);
    });

    it('lässt die Strophen aus, sobald jemand auf den Titel einengt', () => {
        const { filteredSongs, setSearchScope } = suche('wahrheit');
        setSearchScope('titel');
        expect(filteredSongs.value).toEqual([]);
    });

    it('sagt der leeren Trefferliste, wie viel im Liedtext stünde', () => {
        const { verseOnlyMatches, setSearchScope } = suche('wahrheit');

        // Im Textbereich ist die Frage schon beantwortet — dann zählt niemand nach.
        expect(verseOnlyMatches.value).toBe(0);

        setSearchScope('titel');
        expect(verseOnlyMatches.value).toBe(1);
    });

    it('zählt nicht nach, solange die Titelsuche etwas hergibt', () => {
        const { verseOnlyMatches, setSearchScope } = suche('morgenstern');
        setSearchScope('titel');
        expect(verseOnlyMatches.value).toBe(0);
    });

    it('behält den Bereich, wenn nur die Filter zurückgesetzt werden', () => {
        const { filters, setSearchScope, clearFiltersKeepSearch, clearAllFilters } =
            suche('wahrheit');

        setSearchScope('titel');
        clearFiltersKeepSearch();
        expect(filters.value.searchScope).toBe('titel');
        expect(filters.value.searchQuery).toBe('wahrheit');

        // „Filter zurücksetzen" räumt dagegen die ganze Frage weg.
        clearAllFilters();
        expect(filters.value.searchScope).toBe('text');
    });
});
