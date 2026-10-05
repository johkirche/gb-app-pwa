import {
    BIBEL_BOOKS,
    type BibelBook,
    type Block,
    chapterLabel,
    verseRefLabel,
} from '@/utils/bibel';
import { layoutChapter } from '@/utils/bibelLayout';
import type { ParsedBibelRef } from '@/utils/bibelRef';
import { foldForSearch, matchesTerms } from '@/utils/search';

/**
 * Searching the words of the Bible. The rules are the song search's (see
 * utils/search.ts): every word of the query must occur in the verse, compared
 * on the folded text, so "grosser" finds "großer" and "hirte," finds "Hirte".
 *
 * The verse is the unit: a hit is a verse, and the verse is what is shown.
 */

export interface IndexedVerse {
    slug: string;
    chapter: number;
    verse: number;
    /** As read, without verse number or footnotes. */
    text: string;
    /** `text` folded for comparison, once, when the book is indexed. */
    folded: string;
}

/**
 * Every verse of a chapter as plain text, in order. The same text as
 * `verseText` in bibelLayout gives, but in one pass over the chapter: asked
 * verse by verse, Psalm 119 would be walked 176 times.
 */
export function chapterVerses(blocks: Block[]): { verse: number; text: string }[] {
    const order: number[] = [];
    const lines = new Map<number, string[]>();

    for (const block of layoutChapter(blocks)) {
        if (block.kind !== 'para') continue;
        for (const line of block.lines) {
            // Runs within a line meet as written; lines meet with a space.
            const runs = new Map<number, string>();
            for (const seg of line.segments) {
                if (seg.kind === 'verse') {
                    if (!lines.has(seg.verse)) {
                        order.push(seg.verse);
                        lines.set(seg.verse, []);
                    }
                    runs.set(seg.verse, runs.get(seg.verse) ?? '');
                } else if ((seg.kind === 'text' || seg.kind === 'italic') && seg.verse !== null) {
                    runs.set(seg.verse, (runs.get(seg.verse) ?? '') + seg.text);
                }
            }
            for (const [verse, text] of runs) lines.get(verse)?.push(text);
        }
    }

    return order.map((verse) => ({
        verse,
        text: (lines.get(verse) ?? []).join(' ').replace(/\s+/g, ' ').trim(),
    }));
}

/** A book's verses, ready to be searched. Chapters are numbered from 1. */
export function indexBook(slug: string, chapters: Block[][]): IndexedVerse[] {
    return chapters.flatMap((blocks, c) =>
        chapterVerses(blocks)
            .filter(({ text }) => text)
            .map(({ verse, text }) => ({
                slug,
                chapter: c + 1,
                verse,
                text,
                folded: foldForSearch(text),
            })),
    );
}

/** Where to search: the whole Bible, one Testament, or one book (its slug). */
export type BibelScope = 'all' | 'AT' | 'NT' | (string & {});

export function inScope(book: BibelBook, scope: BibelScope): boolean {
    if (scope === 'all') return true;
    if (scope === 'AT' || scope === 'NT') return book.testament === scope;
    return book.slug === scope;
}

export function scopeLabel(scope: BibelScope): string {
    if (scope === 'all') return 'Ganze Bibel';
    if (scope === 'AT') return 'Altes Testament';
    if (scope === 'NT') return 'Neues Testament';
    return BIBEL_BOOKS.find((book) => book.slug === scope)?.name ?? scope;
}

export interface BookHits {
    book: BibelBook;
    /** Every hit in the book, shown or not. */
    count: number;
    /** The hits shown — empty for a book that lies past the cap. */
    verses: IndexedVerse[];
}

export interface VerseSearchResult {
    total: number;
    shown: number;
    /** In canonical order; only books with hits. */
    groups: BookHits[];
}

/**
 * The verses that carry every term, grouped by book. All hits are counted,
 * but only the first `limit` are carried: a common word ("Herr") is in
 * thousands of verses, and a list of thousands helps no one. A book past the
 * cap still shows up with its count, so the reader can narrow to it.
 *
 * `verses` must come in canonical order; the groups follow it.
 */
export function searchVerses(
    verses: Iterable<IndexedVerse>,
    terms: string[],
    scope: BibelScope = 'all',
    limit = 200,
): VerseSearchResult {
    const result: VerseSearchResult = { total: 0, shown: 0, groups: [] };
    if (!terms.length) return result;

    const books = new Map(BIBEL_BOOKS.map((book) => [book.slug, book]));
    let group = null as BookHits | null;

    for (const verse of verses) {
        if (group?.book.slug !== verse.slug) {
            const book = books.get(verse.slug);
            if (!book || !inScope(book, scope)) continue;
        }
        if (!matchesTerms(terms, [verse.folded])) continue;

        if (group?.book.slug !== verse.slug) {
            group = { book: books.get(verse.slug)!, count: 0, verses: [] };
            result.groups.push(group);
        }
        group.count++;
        result.total++;
        if (result.shown < limit) {
            group.verses.push(verse);
            result.shown++;
        }
    }

    return result;
}

/** "Johannes 3,16", "Johannes 3,16-18", "Psalm 23" — for "Gehe zu …". */
export function referenceLabel(ref: ParsedBibelRef): string {
    const chapter = { slug: ref.slug, chapter: ref.chapter };
    if (ref.verse === undefined) return chapterLabel(chapter);
    const label = verseRefLabel(chapter, ref.verse);
    return ref.endVerse ? `${label}-${ref.endVerse}` : label;
}
