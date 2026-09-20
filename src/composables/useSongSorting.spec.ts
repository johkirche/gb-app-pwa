import { ref } from 'vue';

import { describe, expect, it } from 'vitest';

import { type SortMode, indexLetter, useSongSorting } from '@/composables/useSongSorting';

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
