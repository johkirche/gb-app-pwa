import { describe, expect, it } from 'vitest';

import type { Song } from '@/db';
import { resolvePlaylistEntries } from '@/utils/playlistEntries';

function song(id: string, index: number): Song {
    return {
        id,
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

const LIBRARY = [song('a', 1), song('b', 2)];

describe('resolvePlaylistEntries (Issue #28)', () => {
    it('behält die gespeicherte Reihenfolge', () => {
        const entries = resolvePlaylistEntries(['b', 'a'], LIBRARY);
        expect(entries.map((e) => e.song?.index)).toEqual([2, 1]);
    });

    it('zählt jede gespeicherte id, auch die unauflösbare', () => {
        const entries = resolvePlaylistEntries(['a', 'weg', 'b'], LIBRARY);
        expect(entries).toHaveLength(3);
        expect(entries[1]).toEqual({ id: 'weg', song: null });
    });

    it('ohne Bestand bleibt jede Zeile unaufgelöst', () => {
        const entries = resolvePlaylistEntries(['a', 'b'], []);
        expect(entries.every((e) => e.song === null)).toBe(true);
    });

    it('leere Playlist bleibt leer', () => {
        expect(resolvePlaylistEntries([], LIBRARY)).toEqual([]);
    });
});
