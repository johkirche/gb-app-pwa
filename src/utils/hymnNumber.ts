import type { Song } from '@/db';

/**
 * The hymn number as it appears in a URL, a bulletin or a message — „122" —
 * turned back into the integer the library files the song under.
 *
 * Returns null for anything that is not a plain positive number: the route
 * pattern already keeps letters out, but a pasted „0122" or „12.5" should not
 * quietly land on a different song either.
 */
export function parseHymnNumber(raw: string | string[] | undefined | null): number | null {
    const text = Array.isArray(raw) ? raw[0] : raw;
    if (typeof text !== 'string' || !/^[1-9]\d*$/.test(text.trim())) return null;
    return Number.parseInt(text, 10);
}

/** The song the book prints under this number, or null where there is none. */
export function songByNumber(songs: readonly Song[], raw: string | number | null | undefined) {
    const nummer = typeof raw === 'number' ? raw : parseHymnNumber(raw);
    if (nummer === null || !Number.isInteger(nummer) || nummer < 1) return null;
    return songs.find((song) => song.index === nummer) ?? null;
}

// The combining marks NFD splits off a base letter: ä → a + ¨
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * The title as it can stand in an address: „Großer Gott, wir loben dich" →
 * „grosser-gott-wir-loben-dich". Umlauts are spelled out the way a German
 * would type them without the keys, ß becomes ss, and everything that is not
 * a letter or digit becomes one hyphen.
 */
export function hymnSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(COMBINING_MARKS, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * The path a song is shared under.
 *
 * The number is what people already say to each other — „wir singen die 122"
 * — so it is what the link is keyed on; the title follows it so the address
 * can be read as well as typed. Only the number is resolved: a link whose
 * title has since been corrected still opens the right hymn. A song the book
 * has not numbered falls back to its record id, which resolves but cannot be
 * read aloud.
 */
export function hymnPath(song: Pick<Song, 'id' | 'index' | 'titel'>): string {
    if (!(song.index > 0)) return `/songs/${song.id}`;
    const slug = hymnSlug(song.titel);
    return slug ? `/lied/${song.index}-${slug}` : `/lied/${song.index}`;
}

/** The full link, against the origin the app is served from. */
export function hymnLink(song: Pick<Song, 'id' | 'index' | 'titel'>, origin: string): string {
    return `${origin.replace(/\/+$/, '')}${hymnPath(song)}`;
}
