import { ref } from 'vue';

import { describe, expect, it } from 'vitest';

import {
    type SongRanks,
    type SortMode,
    indexLetter,
    useSongSorting,
} from '@/composables/useSongSorting';

import type { Song } from '@/db';

describe('indexLetter (Issue #28)', () => {
    it('führt Umlaute bei ihrem Grundbuchstaben', () => {
        expect(indexLetter('Ändere mich')).toBe('A');
        expect(indexLetter('Öffne mir die Augen')).toBe('O');
        expect(indexLetter('Über allem steht der Herr')).toBe('U');
    });

    it('sortiert ß wie S', () => {
        expect(indexLetter('ßonderfall')).toBe('S');
    });

    it('bleibt bei den übrigen Buchstaben', () => {
        expect(indexLetter('Großer Gott, wir loben dich')).toBe('G');
        expect(indexLetter('  Wachet auf')).toBe('W');
        expect(indexLetter('mein Heiland')).toBe('M');
    });

    it('sammelt alles andere unter #', () => {
        expect(indexLetter('1. Advent')).toBe('#');
        expect(indexLetter('„Kommt her zu mir"')).toBe('#');
        expect(indexLetter('')).toBe('#');
    });
});

describe('every section says what it is', () => {
    function song(index: number, titel: string): Song {
        return {
            id: `s${index}`,
            index,
            titel,
            strophen: [],
            textAutoren: [],
            melodieAutoren: [],
            noten: [],
            notentextMxml: null,
            kategorien: [],
        };
    }

    function sectionsFor(mode: SortMode, songs: Song[]) {
        const list = ref(songs);
        const sorting = useSongSorting(list);
        sorting.sortMode.value = mode;
        return sorting;
    }

    it('names a number block by the hymns it actually holds', () => {
        // Blocks of 15 keyed on their first number — but the hymnal stops
        // where it stops, and the numbering has gaps.
        const { sortedSections } = sectionsFor('index', [
            song(1, 'Eins'),
            song(4, 'Vier'),
            song(15, 'Fünfzehn'),
            song(29, 'Neunundzwanzig'),
            song(30, 'Dreißig'),
        ]);

        expect(sortedSections.value.map((s) => [s.label, s.spokenLabel])).toEqual([
            ['1', 'Lieder 1 bis 4'],
            ['15', 'Lieder 15 bis 29'],
            ['30', 'Lied 30'],
        ]);
    });

    it('spells out a letter, and never reads # as punctuation', () => {
        const { sortedSections } = sectionsFor('alphabetical', [
            song(1, 'Ahnung'),
            song(2, 'Öffne mir'),
            song(3, '1. Advent'),
        ]);

        expect(sortedSections.value.map((s) => [s.label, s.spokenLabel])).toEqual([
            ['A', 'Buchstabe A'],
            ['O', 'Buchstabe O'],
            ['#', 'Zahlen und Zeichen'],
        ]);
    });

    it('hands the rail the same sentence the heading uses', () => {
        // One spoken form per section: the button and the <h2> cannot drift.
        const { sortedSections, indexItems } = sectionsFor('alphabetical', [
            song(1, 'Ahnung'),
            song(2, 'Bald'),
        ]);

        expect(indexItems.value.map((i) => i.ariaLabel)).toEqual(
            sortedSections.value.map((s) => s.spokenLabel),
        );
    });
});

describe('Treffer nach Übereinstimmung', () => {
    function song(index: number, titel: string): Song {
        return {
            id: `s${index}`,
            index,
            titel,
            strophen: [],
            textAutoren: [],
            melodieAutoren: [],
            noten: [],
            notentextMxml: null,
            kategorien: [],
        };
    }

    const LIEDER = [song(1, 'Eins'), song(2, 'Zwei'), song(3, 'Drei')];

    function sortingFor(ranks: SongRanks, mode: SortMode = 'index') {
        const sorting = useSongSorting(ref(LIEDER), ref(ranks));
        sorting.sortMode.value = mode;
        return sorting;
    }

    it('stellt die Liste als einen Abschnitt hin, am besten passend zuerst', () => {
        const { sortedSections } = sortingFor(
            new Map([
                ['s1', 4],
                ['s2', 30],
                ['s3', 12],
            ]),
        );

        expect(sortedSections.value).toHaveLength(1);
        expect(sortedSections.value[0].key).toBe('treffer');
        expect(sortedSections.value[0].songs.map((s) => s.index)).toEqual([2, 3, 1]);
    });

    it('lässt bei Gleichstand die gewählte Sortierung entscheiden', () => {
        const gleich: SongRanks = new Map([
            ['s1', 4],
            ['s2', 4],
            ['s3', 4],
        ]);

        expect(sortingFor(gleich).sortedSections.value[0].songs.map((s) => s.index)).toEqual([
            1, 2, 3,
        ]);
        expect(
            sortingFor(gleich, 'alphabetical').sortedSections.value[0].songs.map((s) => s.titel),
        ).toEqual(['Drei', 'Eins', 'Zwei']);
    });

    it('nimmt Register und Zwischenüberschriften zurück, solange gewertet wird', () => {
        const { showHeaders, showIndexScroll } = sortingFor(new Map([['s1', 4]]), 'alphabetical');
        expect(showHeaders.value).toBe(false);
        expect(showIndexScroll.value).toBe(false);
    });

    it('stellt über nichts keinen Abschnitt hin', () => {
        // Sonst sähe die leere Suche wie ein Ergebnis aus, und die Seite käme
        // nie zu „Keine Ergebnisse".
        const sorting = useSongSorting(ref([] as Song[]), ref(new Map() as SongRanks));
        expect(sorting.sortedSections.value).toEqual([]);
    });

    it('lässt ohne Wertung alles, wie es war', () => {
        const { sortedSections, showIndexScroll } = sortingFor(null, 'alphabetical');
        expect(sortedSections.value.map((s) => s.label)).toEqual(['D', 'E', 'Z']);
        expect(showIndexScroll.value).toBe(true);
    });
});
