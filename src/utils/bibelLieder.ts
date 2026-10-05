import type { Song } from '@/db';
import { type Bibelstelle, type BibelstellenData, bibelstellenFor } from '@/utils/bibelstellen';

/**
 * The Bibelstellen read backwards: from a chapter to the songs whose texts
 * draw on it. The data is keyed by text, as the song page needs it; the Bibel
 * tab needs the other direction, and it is cheap enough (some 1,500 passages)
 * to turn round on the device whenever the library changes.
 */

/** A song and the passages in one chapter its text cites. */
export interface ChapterSong {
    song: Song;
    stellen: Bibelstelle[];
}

/** `slug/chapter` → the songs citing it, by Liednummer. */
export type ChapterSongIndex = Map<string, ChapterSong[]>;

function chapterKey(slug: string, chapter: number): string {
    return `${slug}/${chapter}`;
}

// The chapter and verse a reference ends on: "1,1-2,3", "21,1-11", "23,4",
// or a bare chapter. Only needed where the wording was too long to ship —
// otherwise the verses themselves say where the passage runs.
const REF_TAIL = /\s(\d+)(?:,(\d+)(?:-(\d+)(?:,(\d+))?)?)?$/;

/**
 * Every verse a passage covers, as [chapter, first verse, last verse] runs;
 * a last verse of Infinity stands for "to the end of the chapter".
 */
export function stelleSpan(stelle: Bibelstelle): [number, number, number][] {
    if (stelle.verses?.length) {
        const runs = new Map<number, [number, number, number]>();
        for (const [chapter, verse] of stelle.verses) {
            const run = runs.get(chapter);
            if (run) {
                run[1] = Math.min(run[1], verse);
                run[2] = Math.max(run[2], verse);
            } else runs.set(chapter, [chapter, verse, verse]);
        }
        return [...runs.values()];
    }

    const [, startChapter, startVerse] = stelle.at;
    const m = REF_TAIL.exec(stelle.ref);
    if (!m || !m[2]) return [[startChapter, 1, Infinity]];
    if (m[4]) {
        // Across chapters: "1. Mose 1,1-2,3".
        const endChapter = Number(m[3]);
        const runs: [number, number, number][] = [];
        for (let c = startChapter; c <= endChapter; c++) {
            runs.push([
                c,
                c === startChapter ? startVerse : 1,
                c === endChapter ? Number(m[4]) : Infinity,
            ]);
        }
        return runs;
    }
    return [[startChapter, startVerse, m[3] ? Number(m[3]) : startVerse]];
}

/** Whether the passage takes in that verse of that chapter. */
export function stelleCovers(stelle: Bibelstelle, chapter: number, verse: number): boolean {
    return stelleSpan(stelle).some(
        ([c, from, to]) => c === chapter && verse >= from && verse <= to,
    );
}

/**
 * Build the index from the passage data and the songs on this device. Songs
 * are matched by their text id, falling back to the title for songs synced
 * before the id was (see bibelstellenFor) — so the index can only ever list
 * songs the reader can open.
 */
export function buildChapterSongIndex(data: BibelstellenData, songs: Song[]): ChapterSongIndex {
    const index: ChapterSongIndex = new Map();

    for (const song of songs) {
        const perChapter = new Map<string, Bibelstelle[]>();
        for (const stelle of bibelstellenFor(data, song)) {
            for (const [chapter] of stelleSpan(stelle)) {
                const key = chapterKey(stelle.at[0], chapter);
                const list = perChapter.get(key) ?? [];
                if (!list.includes(stelle)) list.push(stelle);
                perChapter.set(key, list);
            }
        }
        for (const [key, stellen] of perChapter) {
            const list = index.get(key) ?? [];
            list.push({ song, stellen });
            index.set(key, list);
        }
    }

    // By Liednummer, the order the book itself gives them; songs without one
    // go last rather than first.
    const order = (song: Song) => song.index || Number.MAX_SAFE_INTEGER;
    for (const list of index.values()) {
        list.sort(
            (a, b) =>
                order(a.song) - order(b.song) || a.song.titel.localeCompare(b.song.titel, 'de'),
        );
    }
    return index;
}

export function songsForChapter(
    index: ChapterSongIndex,
    slug: string,
    chapter: number,
): ChapterSong[] {
    return index.get(chapterKey(slug, chapter)) ?? [];
}

/**
 * The one song to name beside a single verse: one whose passage takes in that
 * verse, if there is such a song, otherwise the first that cites the chapter.
 */
export function songForVerse(
    index: ChapterSongIndex,
    slug: string,
    chapter: number,
    verse: number,
): ChapterSong | null {
    const list = songsForChapter(index, slug, chapter);
    return (
        list.find((entry) => entry.stellen.some((s) => stelleCovers(s, chapter, verse))) ??
        list[0] ??
        null
    );
}

/**
 * The verses of a chapter that some song cites — for a reader that wants to
 * mark them. Whole-chapter references are left out: they would mark everything.
 */
export function citedVerses(entries: ChapterSong[], chapter: number): Set<number> {
    const verses = new Set<number>();
    for (const { stellen } of entries) {
        for (const stelle of stellen) {
            for (const [c, from, to] of stelleSpan(stelle)) {
                if (c !== chapter || to === Infinity) continue;
                for (let v = from; v <= to; v++) verses.add(v);
            }
        }
    }
    return verses;
}
