import { shallowRef } from 'vue';

import { type Song, db } from '@/db';
import type { Block } from '@/utils/bibel';
import { layoutChapter, verseText } from '@/utils/bibelLayout';

/**
 * Bibelstellen: the passages a song text draws on.
 *
 * Not part of the app. The file is kept in Directus beside the songs
 * (`gesangbuch-bibelstellen.json`, built and uploaded by gb-scripts) and
 * downloaded with them during the sync — behind the login, because it quotes
 * the songs where it names the line a passage belongs to, and many song texts
 * are under copyright. Where the file is not there, there are no Bibelstellen:
 * whether the hymnal offers them is decided by uploading it, nothing else.
 *
 * It names passages only. Their wording comes from the Bible the app already
 * carries, in the translation the reader chose.
 *
 * Keyed by the Directus `text` id, since a text and its references are shared
 * by every Lied that sings it.
 */

/** One verse: chapter, verse, text. */
export type BibelVers = [number, number, string];

export interface Bibelstelle {
    /** The reference as read, e.g. "Matthäus 21,1-11". */
    ref: string;
    /** What the song takes from the passage, in a phrase. */
    note: string;
    /** Where it starts in the Bible: book slug, chapter, verse. */
    at: [string, number, number];
    /**
     * The words of the song that take the passage up, where one particular
     * line does (strophe 1-based). Most passages have none: they speak to the
     * song as a whole, and no line is guessed for them.
     */
    line?: { strophe: number; text: string };
}

export interface BibelstellenData {
    byText: Record<string, Bibelstelle[]>;
    /** Normalised title → text id, for songs stored before textId was synced. */
    byTitle: Record<string, string>;
}

/** Where the synced file is kept on the device (db.meta). */
export const BIBELSTELLEN_META_KEY = 'bibelstellen.file';

/** The file as last synced; null while it is not on the device. */
export const bibelstellen = shallowRef<BibelstellenData | null>(null);

/** Whether the shape is one this app can read — the file comes from outside. */
export function isBibelstellenData(value: unknown): value is BibelstellenData {
    if (!value || typeof value !== 'object') return false;
    const data = value as Partial<BibelstellenData>;
    return (
        !!data.byText &&
        typeof data.byText === 'object' &&
        !!data.byTitle &&
        typeof data.byTitle === 'object'
    );
}

let pending: Promise<BibelstellenData | null> | null = null;

/** Read the synced file from the device, once; again after `reloadBibelstellen`. */
export function loadBibelstellen(): Promise<BibelstellenData | null> {
    pending ??= db.meta
        .get(BIBELSTELLEN_META_KEY)
        .then((entry) => {
            const parsed: unknown = entry ? JSON.parse(entry.value) : null;
            bibelstellen.value = isBibelstellenData(parsed) ? parsed : null;
            return bibelstellen.value;
        })
        .catch((error: unknown) => {
            // Let the next caller try again rather than caching the failure.
            pending = null;
            throw error;
        });
    return pending;
}

/** After a sync stored a new file (or found it gone): read it again. */
export function reloadBibelstellen(): Promise<BibelstellenData | null> {
    pending = null;
    return loadBibelstellen();
}

/** Same normalisation as title_key() in gb-scripts' bibelstellen build. */
export function titleKey(title: string): string {
    return title
        .normalize('NFC')
        .replace(/­/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_]+/gu, ' ')
        .trim();
}

export function bibelstellenFor(
    data: BibelstellenData,
    song: Pick<Song, 'textId' | 'titel'>,
): Bibelstelle[] {
    const textId = song.textId ?? data.byTitle[titleKey(song.titel)];
    return (textId && data.byText[textId]) || [];
}

/**
 * The passages in the order the song gives them: first those tied to a line,
 * by strophe; then those about the song as a whole. Within each, the order the
 * check listed them in.
 */
export function groupByLine(stellen: Bibelstelle[]): {
    toLines: Bibelstelle[];
    whole: Bibelstelle[];
} {
    const toLines = stellen
        .filter((stelle) => stelle.line)
        .sort((a, b) => (a.line?.strophe ?? 0) - (b.line?.strophe ?? 0));
    return { toLines, whole: stellen.filter((stelle) => !stelle.line) };
}

// The chapter and verse a reference ends on: "1,1-2,3", "21,1-11", "23,4",
// or a bare chapter.
const REF_TAIL = /\s(\d+)(?:,(\d+)(?:-(\d+)(?:,(\d+))?)?)?$/;

/**
 * Every verse a passage covers, as [chapter, first verse, last verse] runs;
 * a last verse of Infinity stands for "to the end of the chapter".
 */
export function stelleSpan(stelle: Bibelstelle): [number, number, number][] {
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

/**
 * The passage's wording, verse by verse, from a book's chapters — in whichever
 * translation those are. A verse the translation does not have is left out.
 */
export function stelleVerses(stelle: Bibelstelle, chapters: Block[][]): BibelVers[] {
    const verses: BibelVers[] = [];
    for (const [chapter, from, to] of stelleSpan(stelle)) {
        const laid = layoutChapter(chapters[chapter - 1] ?? []);
        const numbers = new Set<number>();
        for (const block of laid) {
            if (block.kind !== 'para') continue;
            for (const line of block.lines) {
                for (const seg of line.segments) {
                    if (seg.kind === 'verse' && seg.verse >= from && seg.verse <= to) {
                        numbers.add(seg.verse);
                    }
                }
            }
        }
        for (const verse of [...numbers].sort((a, b) => a - b)) {
            const text = verseText(laid, verse);
            if (text) verses.push([chapter, verse, text]);
        }
    }
    return verses;
}

/**
 * The verse number to print before each verse: "3", or "4,1" where the
 * passage crosses into another chapter.
 */
export function verseLabel(verses: BibelVers[], index: number): string {
    const [chapter, verse] = verses[index];
    const crossesChapters = verses.some(([c]) => c !== verses[0][0]);
    return crossesChapters ? `${chapter},${verse}` : String(verse);
}
