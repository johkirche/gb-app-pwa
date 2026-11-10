import type { BibelPassage } from '@/db';

/**
 * Places in a text, as the reader's lists and marks keep them: a work and a
 * path into it. The Bible is `bibel` + `book/chapter/verse`; a text that joins
 * it later (the Glaubensgrundlagen) brings its own work name and its own paths,
 * and nothing about lists or marks has to change for it.
 *
 * Pure on purpose — no lookups — so the database upgrade can use it.
 */

export const BIBEL_WORK = 'bibel';

/** Where a passage begins and, for a range, where it ends. */
export interface TextRef {
    work: string;
    ref: string;
    refEnd: string | null;
}

export function passageToRef(passage: BibelPassage): TextRef {
    const chapter = `${passage.slug}/${passage.chapter}`;
    if (!passage.verse) return { work: BIBEL_WORK, ref: chapter, refEnd: null };
    return {
        work: BIBEL_WORK,
        ref: `${chapter}/${passage.verse}`,
        refEnd: passage.endVerse ? `${chapter}/${passage.endVerse}` : null,
    };
}

function count(part: string | undefined): number | undefined {
    if (part === undefined || !/^\d+$/.test(part)) return undefined;
    const n = Number(part);
    return n >= 1 ? n : undefined;
}

/**
 * The passage a Bible ref names, or null for another work or a ref that is not
 * one. Not checked against the book list: callers that need that pass the
 * result through toPassage.
 */
export function refToPassage(ref: TextRef): BibelPassage | null {
    if (ref.work !== BIBEL_WORK) return null;
    const [slug, chapterPart, versePart, ...rest] = ref.ref.split('/');
    const chapter = count(chapterPart);
    if (!slug || chapter === undefined || rest.length > 0) return null;
    const passage: BibelPassage = { slug, chapter };
    const verse = count(versePart);
    if (versePart !== undefined && verse === undefined) return null;
    if (verse !== undefined) {
        passage.verse = verse;
        const end = count(ref.refEnd?.split('/')[2]);
        if (end !== undefined && end > verse) passage.endVerse = end;
    }
    return passage;
}

/** The key that names a place within a list: one entry per place. */
export function refItemKey(ref: TextRef): string {
    return `passage:${ref.work}/${ref.ref}${ref.refEnd ? `-${ref.refEnd}` : ''}`;
}

export function songItemKeyOf(songId: string): string {
    return `song:${songId}`;
}

export function listItemKeyOf(listId: string): string {
    return `list:${listId}`;
}

/** A mark's key on the device: one row per place in a text. */
export function markId(work: string, ref: string): string {
    return `${work}/${ref}`;
}

export function verseMarkId(slug: string, chapter: number, verse: number): string {
    return markId(BIBEL_WORK, `${slug}/${chapter}/${verse}`);
}

export function chapterMarkId(slug: string, chapter: number): string {
    return markId(BIBEL_WORK, `${slug}/${chapter}`);
}

/** The work and ref a mark key stands for. */
export function splitMarkId(id: string): { work: string; ref: string } {
    const slash = id.indexOf('/');
    return slash < 0
        ? { work: id, ref: '' }
        : { work: id.slice(0, slash), ref: id.slice(slash + 1) };
}
