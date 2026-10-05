import type { Song } from '@/db';

/**
 * Bibelstellen: the passages a song text draws on, with their wording.
 *
 * The data is built by scripts/build-bibel.py from the references gb-scripts
 * extracted and verified, set in the Menge-Bibel (1939, public domain) — the
 * same text the Bibel tab reads, so a passage opens in context word for word.
 * It is keyed by the Directus `text` id, since a text and its references are
 * shared by every Lied that sings it.
 *
 * Its own chunk, imported on first use, so it stays out of the start-up
 * bundle. The service worker precaches it like every other chunk (~180 KB
 * gzipped), which is what makes the passages work offline.
 */

/** One verse: chapter, verse, text. */
export type BibelVers = [number, number, string];

export interface Bibelstelle {
    /** The reference as read, e.g. "Matthäus 21,1-11". */
    ref: string;
    /** What the song takes from the passage, in a phrase. */
    note: string;
    /** The wording — absent where the passage is too long to quote. */
    verses?: BibelVers[];
    /** Where it starts in the Bible: book slug, chapter, verse. */
    at: [string, number, number];
    /**
     * The words of the song that cite the passage, where they are known
     * (strophe 1-based). Most passages have none: they speak to the song as a
     * whole, and no line is guessed for them. Never in the bundled file —
     * song texts stay behind the login — so only from the synced songs.
     */
    line?: { strophe: number; text: string };
}

export interface BibelstellenData {
    translation: string;
    byText: Record<string, Bibelstelle[]>;
    /** Normalised title → text id, for songs stored before textId was synced. */
    byTitle: Record<string, string>;
}

let pending: Promise<BibelstellenData> | null = null;

export function loadBibelstellen(): Promise<BibelstellenData> {
    pending ??= import('@/assets/bibelstellen.json')
        .then((module) => module.default as unknown as BibelstellenData)
        .catch((error: unknown) => {
            // Let the next song try again rather than caching the failure.
            pending = null;
            throw error;
        });
    return pending;
}

/** Same normalisation as title_key() in scripts/build-bibelstellen.py. */
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

/**
 * The verse number to print before each verse: "3", or "4,1" where the
 * passage crosses into another chapter.
 */
export function verseLabel(verses: BibelVers[], index: number): string {
    const [chapter, verse] = verses[index];
    const crossesChapters = verses.some(([c]) => c !== verses[0][0]);
    return crossesChapters ? `${chapter},${verse}` : String(verse);
}
