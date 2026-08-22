import { describe, expect, it } from 'vitest';

import type { Song } from '@/db';
import { getIsoWeek, pickSongOfTheWeek } from '@/utils/songOfTheWeek';

// Only the two fields the rotation looks at
function song(index: number): Song {
    return {
        id: `s${index}`,
        index,
        titel: `Lied ${index}`,
        strophen: [],
        textAutoren: [],
        melodieAutoren: [],
        noten: [],
        notentextMxml: null,
        kategorien: [],
    };
}

// A library the size of the real one, deliberately handed over in title order
// (as the store does) rather than by Liednummer.
const LIBRARY = Array.from({ length: 641 }, (_, i) => song(i + 1)).sort((a, b) =>
    a.titel.localeCompare(b.titel, 'de'),
);

describe('getIsoWeek', () => {
    it('zählt die Woche im Jahr', () => {
        expect(getIsoWeek(new Date('2026-01-08T12:00:00'))).toEqual({ year: 2026, week: 2 });
        expect(getIsoWeek(new Date('2026-08-22T12:00:00'))).toEqual({ year: 2026, week: 34 });
    });

    it('rechnet den Jahreswechsel nach ISO-8601', () => {
        // Der 1. Januar 2027 ist ein Freitag und gehört noch in die 53. Woche 2026
        expect(getIsoWeek(new Date('2027-01-01T12:00:00'))).toEqual({ year: 2026, week: 53 });
        // Der 31. Dezember 2024 ist ein Dienstag und zählt schon zu Woche 1/2025
        expect(getIsoWeek(new Date('2024-12-31T12:00:00'))).toEqual({ year: 2025, week: 1 });
    });
});

describe('pickSongOfTheWeek', () => {
    it('bleibt eine Woche lang beim selben Lied', () => {
        const monday = pickSongOfTheWeek(LIBRARY, new Date('2026-08-17T08:00:00'));
        const sunday = pickSongOfTheWeek(LIBRARY, new Date('2026-08-23T20:00:00'));
        expect(monday).not.toBeNull();
        expect(sunday?.id).toBe(monday?.id);
    });

    it('wechselt mit der Woche', () => {
        const thisWeek = pickSongOfTheWeek(LIBRARY, new Date('2026-08-19T08:00:00'));
        const nextWeek = pickSongOfTheWeek(LIBRARY, new Date('2026-08-26T08:00:00'));
        expect(nextWeek?.id).not.toBe(thisWeek?.id);
    });

    // Der Fehler aus Issue #28: `woche % anzahl` erreichte nur die ersten 53
    // Lieder einer alphabetisch sortierten Liste.
    it('erreicht jedes Lied der Bibliothek', () => {
        const seen = new Set<string>();
        const start = new Date('2026-01-01T12:00:00');
        for (let week = 0; week < LIBRARY.length * 2; week++) {
            const date = new Date(start.getTime() + week * 7 * 24 * 60 * 60 * 1000);
            const picked = pickSongOfTheWeek(LIBRARY, date);
            if (picked) seen.add(picked.id);
        }
        expect(seen.size).toBe(LIBRARY.length);
    });

    it('lässt Lieder ohne Nummer aus und verträgt eine leere Bibliothek', () => {
        expect(pickSongOfTheWeek([], new Date('2026-08-22T12:00:00'))).toBeNull();
        expect(pickSongOfTheWeek([song(0)], new Date('2026-08-22T12:00:00'))).toBeNull();
    });
});
