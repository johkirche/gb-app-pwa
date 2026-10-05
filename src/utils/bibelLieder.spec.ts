import { describe, expect, it } from 'vitest';

import bibelstellen from '@/assets/bibelstellen.json';

import type { Song } from '@/db';
import {
    buildChapterSongIndex,
    citedVerses,
    songForVerse,
    songsForChapter,
    stelleCovers,
    stelleSpan,
} from '@/utils/bibelLieder';
import type { Bibelstelle, BibelstellenData } from '@/utils/bibelstellen';

function song(id: string, index: number, titel: string, textId?: string): Song {
    return {
        id,
        index,
        titel,
        textId,
        strophen: [],
        textAutoren: [],
        melodieAutoren: [],
        noten: [],
        notentextMxml: null,
        kategorien: [],
    };
}

const PSALM_23_1: Bibelstelle = {
    ref: 'Psalm 23,1',
    note: 'Der Herr ist mein Hirte',
    at: ['psalm', 23, 1],
    verses: [[23, 1, 'Der HERR ist mein Hirte …']],
};
const PSALM_23_4: Bibelstelle = {
    ref: 'Psalm 23,4',
    note: 'Im finstern Tal',
    at: ['psalm', 23, 4],
    verses: [[23, 4, 'Und wenn ich auch wandern müßte …']],
};
const SCHOEPFUNG: Bibelstelle = {
    ref: '1. Mose 1,1-2,3',
    note: 'Die Schöpfung',
    at: ['1-mose', 1, 1],
};
const LUKAS_2: Bibelstelle = {
    ref: 'Lukas 2',
    note: 'Die Weihnachtsgeschichte',
    at: ['lukas', 2, 1],
};

const data: BibelstellenData = {
    translation: 'Menge-Bibel (1939)',
    byText: {
        hirte: [PSALM_23_1],
        tal: [PSALM_23_4, PSALM_23_1],
        schoepfung: [SCHOEPFUNG],
        weihnacht: [LUKAS_2],
    },
    byTitle: { 'der herr ist mein getreuer hirt': 'hirte' },
};

describe('stelleSpan', () => {
    it('reads the run from the verses where they were shipped', () => {
        expect(stelleSpan(PSALM_23_4)).toEqual([[23, 4, 4]]);
    });

    it('reads a passage across chapters from its reference', () => {
        expect(stelleSpan(SCHOEPFUNG)).toEqual([
            [1, 1, Infinity],
            [2, 1, 3],
        ]);
    });

    it('takes a bare chapter as the whole of it', () => {
        expect(stelleSpan(LUKAS_2)).toEqual([[2, 1, Infinity]]);
    });

    it('reads a range within a chapter', () => {
        expect(stelleSpan({ ref: 'Matthäus 21,1-11', note: '', at: ['matthaeus', 21, 1] })).toEqual(
            [[21, 1, 11]],
        );
    });
});

describe('stelleCovers', () => {
    it('knows the verses a passage takes in', () => {
        expect(stelleCovers(SCHOEPFUNG, 2, 3)).toBe(true);
        expect(stelleCovers(SCHOEPFUNG, 2, 4)).toBe(false);
        expect(stelleCovers(PSALM_23_1, 23, 4)).toBe(false);
    });
});

describe('buildChapterSongIndex', () => {
    const songs = [
        song('b', 12, 'Wenn ich auch wandre', 'tal'),
        song('a', 3, 'Der Herr ist mein getreuer Hirt'), // no textId: found by title
        song('c', 40, 'Lobt Gott, ihr Christen', 'weihnacht'),
        song('d', 7, 'Ohne Bibelstellen', 'nichts'),
        song('e', 9, 'Schöpfungslied', 'schoepfung'),
    ];
    const index = buildChapterSongIndex(data, songs);

    it('lists the songs citing a chapter, by Liednummer', () => {
        expect(songsForChapter(index, 'psalm', 23).map((e) => e.song.id)).toEqual(['a', 'b']);
    });

    it('gathers all of a song’s passages in that chapter under one entry', () => {
        const tal = songsForChapter(index, 'psalm', 23).find((e) => e.song.id === 'b');
        expect(tal?.stellen.map((s) => s.ref)).toEqual(['Psalm 23,4', 'Psalm 23,1']);
    });

    it('files a passage under every chapter it runs through', () => {
        expect(songsForChapter(index, '1-mose', 1).map((e) => e.song.id)).toEqual(['e']);
        expect(songsForChapter(index, '1-mose', 2).map((e) => e.song.id)).toEqual(['e']);
        expect(songsForChapter(index, '1-mose', 3)).toEqual([]);
    });

    it('only knows the songs on this device', () => {
        expect(buildChapterSongIndex(data, []).size).toBe(0);
    });

    it('turns the whole shipped data round without losing a passage', () => {
        const real = bibelstellen as unknown as BibelstellenData;
        const library = Object.keys(real.byText).map((textId, i) =>
            song(`s${i}`, i + 1, `Lied ${i}`, textId),
        );
        const full = buildChapterSongIndex(real, library);
        const cited = new Set([...full.values()].flatMap((list) => list.flatMap((e) => e.stellen)));
        expect(cited.size).toBe(Object.values(real.byText).flat().length);
    });
});

describe('songForVerse', () => {
    const index = buildChapterSongIndex(data, [
        song('a', 3, 'Der Herr ist mein getreuer Hirt'),
        song('b', 12, 'Wenn ich auch wandre', 'tal'),
    ]);

    it('prefers a song whose passage takes in the verse', () => {
        expect(songForVerse(index, 'psalm', 23, 4)?.song.id).toBe('b');
    });

    it('falls back to the first song citing the chapter', () => {
        expect(songForVerse(index, 'psalm', 23, 6)?.song.id).toBe('a');
    });

    it('is null for a chapter no song cites', () => {
        expect(songForVerse(index, 'psalm', 24, 1)).toBeNull();
    });
});

describe('citedVerses', () => {
    it('collects the cited verses, leaving whole chapters out', () => {
        const index = buildChapterSongIndex(data, [
            song('b', 12, 'Wenn ich auch wandre', 'tal'),
            song('e', 9, 'Schöpfungslied', 'schoepfung'),
        ]);
        expect([...citedVerses(songsForChapter(index, 'psalm', 23), 23)].sort()).toEqual([1, 4]);
        expect([...citedVerses(songsForChapter(index, '1-mose', 2), 2)]).toEqual([1, 2, 3]);
        expect(citedVerses(songsForChapter(index, '1-mose', 1), 1).size).toBe(0);
    });
});
