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

/**
 * The path a song is shared under.
 *
 * The number is what people already say to each other — „wir singen die 122"
 * — so it is what the link says too. A song the book has not numbered falls
 * back to its record id, which resolves but cannot be read aloud.
 */
export function hymnPath(song: Pick<Song, 'id' | 'index'>): string {
    return song.index > 0 ? `/lied/${song.index}` : `/songs/${song.id}`;
}

/** The full link, against the origin the app is served from. */
export function hymnLink(song: Pick<Song, 'id' | 'index'>, origin: string): string {
    return `${origin.replace(/\/+$/, '')}${hymnPath(song)}`;
}
