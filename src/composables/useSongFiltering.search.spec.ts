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
    }),
];

describe('Suche', () => {
    function suche(query: string) {
        const filtering = useSongFiltering(ref(LIEDER));
        filtering.setSearchQuery(query);
        return filtering;
    }

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
