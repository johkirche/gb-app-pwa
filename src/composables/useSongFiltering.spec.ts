import { ref } from 'vue';

import { describe, expect, it } from 'vitest';

import { useSongFiltering } from '@/composables/useSongFiltering';

import type { Song } from '@/db';

// Nur die Felder, um die es hier geht — der Rest des Liedes ist für den Filter
// bedeutungslos und würde jeden Fall nur zustellen.
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

// Zwei Lieder auf derselben Weise (Choralbuch 12), eines auf einer eigenen.
const LIEDER = [
    song({
        id: '1',
        index: 100,
        titel: 'Ich bin ein Kind auf Erden',
        melodieId: '3',
        melodieTitel: 'Ich bin ein Kind auf Erden',
        choralbuchNummer: 12,
    }),
    song({
        id: '2',
        index: 200,
        titel: 'Ein anderer Text, dieselbe Weise',
        melodieId: '3',
        melodieTitel: 'Ich bin ein Kind auf Erden',
        choralbuchNummer: 12,
    }),
    song({
        id: '3',
        index: 300,
        titel: 'Auf eigener Weise',
        melodieId: '7',
        melodieTitel: 'Eigene Weise',
        choralbuchNummer: 4,
    }),
];

describe('Weisen-Filter', () => {
    it('fasst Lieder über die Melodie-id zusammen und zählt sie', () => {
        const { availableMelodien } = useSongFiltering(ref(LIEDER));

        // Nach Choralbuchnummer sortiert, nicht nach Titel.
        expect(availableMelodien.value).toEqual([
            { label: '4 · Eigene Weise', value: '7', count: 1 },
            { label: '12 · Ich bin ein Kind auf Erden', value: '3', count: 2 },
        ]);
    });

    it('zeigt genau die Lieder auf der gewählten Weise', () => {
        const { filteredSongs, setMelodien } = useSongFiltering(ref(LIEDER));

        setMelodien(['3']);

        expect(filteredSongs.value.map((s) => s.id)).toEqual(['1', '2']);
    });

    it('zählt als aktiver Filter und verschwindet beim Zurücksetzen', () => {
        const { hasActiveFilters, activeFilterCount, setMelodien, clearAllFilters } =
            useSongFiltering(ref(LIEDER));

        setMelodien(['3']);
        expect(hasActiveFilters.value).toBe(true);
        expect(activeFilterCount.value).toBe(1);

        clearAllFilters();
        expect(hasActiveFilters.value).toBe(false);
        expect(activeFilterCount.value).toBe(0);
    });

    it('toggleMelodie nimmt eine Weise dazu und wieder heraus', () => {
        const { filters, toggleMelodie } = useSongFiltering(ref(LIEDER));

        toggleMelodie('3');
        toggleMelodie('7');
        expect(filters.value.selectedMelodien).toEqual(['3', '7']);

        toggleMelodie('3');
        expect(filters.value.selectedMelodien).toEqual(['7']);
    });

    it('schreibt die gewählten Weisen für die Chips aus', () => {
        const { activeMelodien, setMelodien } = useSongFiltering(ref(LIEDER));

        setMelodien(['3']);

        expect(activeMelodien.value).toEqual([
            { id: '3', titel: 'Ich bin ein Kind auf Erden', nummer: 12, count: 2 },
        ]);
    });

    it('lässt Lieder ohne Weise unangetastet durch die übrigen Filter', () => {
        const ohneWeise = song({ id: '4', index: 400, titel: 'Ohne Weise' });
        const { availableMelodien, filteredSongs, setMelodien } = useSongFiltering(
            ref([...LIEDER, ohneWeise]),
        );

        expect(availableMelodien.value.map((m) => m.value)).toEqual(['7', '3']);

        setMelodien(['3']);
        expect(filteredSongs.value.map((s) => s.id)).toEqual(['1', '2']);
    });
});
