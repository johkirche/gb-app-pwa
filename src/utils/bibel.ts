import index from '@/assets/bibel/index.json';

import { type BibelTranslationId, db } from '@/db';

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

// --- Translations -------------------------------------------------------------

export type { BibelTranslationId };

export interface BibelTranslation {
    id: BibelTranslationId;
    /** As the reader is told which text they are reading: "Menge-Bibel (1939)". */
    label: string;
    /** For a column or a line beneath a verse, where the full name will not fit. */
    short: string;
    /** Where the books lie under public/: one `<slug>.json` each. */
    path: string;
}

/**
 * The texts the app ships. Menge is the Bible the app is built around — the
 * book list, the headings, every mark a reader sets — and the only one read
 * on its own. The Lutherbibel 1912 (scripts/build-luther.py) has the same
 * books under the same slugs, to be set beside it.
 */
export const BIBEL_TRANSLATIONS: Record<BibelTranslationId, BibelTranslation> = {
    menge: {
        id: 'menge',
        label: BIBEL_TRANSLATION,
        short: 'Menge',
        path: '/bibeltext/menge',
    },
    luther1912: {
        id: 'luther1912',
        label: 'Lutherbibel (1912)',
        short: 'Luther',
        path: '/bibeltext/luther1912',
    },
};

/** The file a book of a translation is fetched from. */
export function bookUrl(slug: string, translation: BibelTranslationId = 'menge'): string {
    return `${BIBEL_TRANSLATIONS[translation].path}/${slug}.json`;
}

const books = new Map<string, Promise<Block[][]>>();

/** All chapters of a book, fetched once per session and translation. */
export function loadBook(
    slug: string,
    translation: BibelTranslationId = 'menge',
): Promise<Block[][]> {
    const key = `${translation}/${slug}`;
    let pending = books.get(key);
    if (!pending) {
        pending = fetch(bookUrl(slug, translation))
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<{ chapters: Block[][] }>;
            })
            .then((data) => data.chapters)
            .catch((error: unknown) => {
                // Offline and never read: let the next attempt try again.
                books.delete(key);
                throw error;
            });
        books.set(key, pending);
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
