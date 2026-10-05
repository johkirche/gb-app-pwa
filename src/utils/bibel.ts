import index from '@/assets/bibel/index.json';

import { db } from '@/db';

/**
 * Die Bibel: the Menge-Bibel (1939), public domain, built by
 * scripts/build-bibel.py from the CC0 Markdown edition.
 *
 * The book list ships with the app (a few KB). The books themselves sit in
 * public/bibeltext as one file each and are fetched when opened; the service
 * worker keeps every book once read (see bibel-cache in vite.config.ts), so the
 * whole Bible is not a download for readers who never open it.
 */

export interface BibelBook {
    slug: string;
    /** The short name, as references use it: "1. Mose", "Matthäus". */
    name: string;
    /** Menge's own title: "Das Erste Buch Mose". */
    title: string;
    testament: 'AT' | 'NT';
    group: string;
    chapters: number;
}

/** A run of text, a verse number, a footnote, or an italic run. */
export type Segment = string | { v: number } | { n: string } | { e: string };

export interface Line {
    s: Segment[];
    /** Poetry indent, in steps. */
    i?: number;
}

/** A section heading (2 = main division … 4 = subsection), or a paragraph. */
export type Block = { h: number; t: string } | { p: Line[]; q?: 1 };

export const BIBEL_TRANSLATION = index.translation;
export const BIBEL_BOOKS = index.books as BibelBook[];

const bySlug = new Map(BIBEL_BOOKS.map((book) => [book.slug, book]));

export function findBook(slug: string): BibelBook | undefined {
    return bySlug.get(slug);
}

/** The chapter before and after, across book boundaries. */
export function neighbours(
    slug: string,
    chapter: number,
): { prev: ChapterRef | null; next: ChapterRef | null } {
    const at = BIBEL_BOOKS.findIndex((book) => book.slug === slug);
    if (at < 0) return { prev: null, next: null };
    const book = BIBEL_BOOKS[at];

    let prev: ChapterRef | null = null;
    if (chapter > 1) prev = { slug, chapter: chapter - 1 };
    else if (at > 0) {
        const before = BIBEL_BOOKS[at - 1];
        prev = { slug: before.slug, chapter: before.chapters };
    }

    let next: ChapterRef | null = null;
    if (chapter < book.chapters) next = { slug, chapter: chapter + 1 };
    else if (at < BIBEL_BOOKS.length - 1) next = { slug: BIBEL_BOOKS[at + 1].slug, chapter: 1 };

    return { prev, next };
}

export interface ChapterRef {
    slug: string;
    chapter: number;
}

export function chapterLabel(ref: ChapterRef): string {
    const book = findBook(ref.slug);
    if (!book) return '';
    return book.chapters > 1 ? `${book.name} ${ref.chapter}` : book.name;
}

/** "Psalm 23,4" — or "Judas 3" in a book of one chapter. */
export function verseRefLabel(ref: ChapterRef, verse: number): string {
    const book = findBook(ref.slug);
    if (!book) return '';
    return book.chapters > 1 ? `${book.name} ${ref.chapter},${verse}` : `${book.name} ${verse}`;
}

export function chapterPath(ref: ChapterRef, verse?: number): string {
    return `/bibel/${ref.slug}/${ref.chapter}` + (verse ? `?vers=${verse}` : '');
}

const books = new Map<string, Promise<Block[][]>>();

/** All chapters of a book, fetched once per session. */
export function loadBook(slug: string): Promise<Block[][]> {
    let pending = books.get(slug);
    if (!pending) {
        pending = fetch(`/bibeltext/menge/${slug}.json`)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<{ chapters: Block[][] }>;
            })
            .then((data) => data.chapters)
            .catch((error: unknown) => {
                // Offline and never read: let the next attempt try again.
                books.delete(slug);
                throw error;
            });
        books.set(slug, pending);
    }
    return pending;
}

// --- Where the reader left off -------------------------------------------

const LAST_READ_KEY = 'bibel.lastRead';

export async function getLastRead(): Promise<ChapterRef | null> {
    const entry = await db.meta.get(LAST_READ_KEY);
    if (!entry) return null;
    const [slug, chapter] = entry.value.split('/');
    const book = findBook(slug);
    const n = Number(chapter);
    return book && n >= 1 && n <= book.chapters ? { slug, chapter: n } : null;
}

export async function setLastRead(ref: ChapterRef): Promise<void> {
    await db.meta.put({ key: LAST_READ_KEY, value: `${ref.slug}/${ref.chapter}` });
}

/** Personal like the Lesezeichen, so it goes with them on logout. */
export async function clearLastRead(): Promise<void> {
    await db.meta.delete(LAST_READ_KEY);
}
