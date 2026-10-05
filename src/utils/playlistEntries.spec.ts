import { describe, expect, it } from 'vitest';

import type { Playlist, Song } from '@/db';
import { resolvePlaylistEntries, toPlainPlaylist } from '@/utils/playlistEntries';

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

describe('toPlainPlaylist', () => {
    const CREATED = new Date(2026, 0, 1);
    const OLD: Playlist = {
        id: 'p',
        name: 'Erntedank',
        emoji: '🌾',
        songIds: ['a', 'b'],
        createdAt: CREATED,
        updatedAt: CREATED,
    };

    it('schreibt eine Playlist ohne Bibelstellen so zurück, wie sie war', () => {
        const plain = toPlainPlaylist(OLD);
        expect(plain).toEqual(OLD);
        expect('passagen' in plain).toBe(false);
        expect(plain.songIds).not.toBe(OLD.songIds);
    });

    it('kopiert die Bibelstellen und verwirft, was keine ist', () => {
        const passagen = [
            { slug: 'psalm', chapter: 23 },
            { slug: 'gibtsnicht', chapter: 1 },
        ];
        const plain = toPlainPlaylist({ ...OLD, passagen });
        expect(plain.passagen).toEqual([{ slug: 'psalm', chapter: 23 }]);
        expect(plain.passagen?.[0]).not.toBe(passagen[0]);
    });
});
