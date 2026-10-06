import type { BibelPassage } from '@/db';
import { chapterLabel, chapterPath, findBook } from '@/utils/bibel';

/**
 * Passages kept on a service plan (its Lesungen) or in a playlist: one shape
 * for both, so a playlist adopted as a service brings its readings along and a
 * service saved as a playlist keeps them.
 */

/** "Römer 8,28-30", "Psalm 23", "Judas 3". */
export function passageLabel(passage: BibelPassage): string {
    const book = findBook(passage.slug);
    if (!book) return '';
    const chapter = chapterLabel(passage);
    if (!passage.verse) return chapter;
    const verses = passage.endVerse ? `${passage.verse}-${passage.endVerse}` : `${passage.verse}`;
    return book.chapters > 1 ? `${chapter},${verses}` : `${chapter} ${verses}`;
}

/** Where the passage opens: its chapter, scrolled to its first verse. */
export function passagePath(passage: BibelPassage): string {
    return chapterPath(passage, passage.verse);
}

/** Identity of a passage within a list — the same passage is kept only once. */
export function passageKey(passage: BibelPassage): string {
    return [passage.slug, passage.chapter, passage.verse ?? '', passage.endVerse ?? ''].join('/');
}

/**
 * A plain copy holding only the passage's own fields, or null when it does not
 * name a passage the Bible has. Plain, because Dexie cannot structured-clone
 * the reactive proxy a stored list picks up in a store; checked, because the
 * same function reads a passage back out of an imported backup.
 */
export function toPassage(value: unknown): BibelPassage | null {
    if (!value || typeof value !== 'object') return null;
    const { slug, chapter, verse, endVerse } = value as Record<string, unknown>;
    if (typeof slug !== 'string') return null;
    const book = findBook(slug);
    if (!book || !isCount(chapter) || chapter > book.chapters) return null;

    const passage: BibelPassage = { slug, chapter };
    if (isCount(verse)) {
        passage.verse = verse;
        if (isCount(endVerse) && endVerse > verse) passage.endVerse = endVerse;
    }
    return passage;
}

function isCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** Plain copies of a stored list; whatever is not a passage is dropped. */
export function toPassages(list: unknown): BibelPassage[] {
    if (!Array.isArray(list)) return [];
    return list.map(toPassage).filter((passage): passage is BibelPassage => passage !== null);
}

/** The list with `passage` appended, unless it is already on it. */
export function withPassage(
    list: BibelPassage[] | undefined,
    passage: BibelPassage,
): BibelPassage[] {
    const current = toPassages(list);
    const added = toPassage(passage);
    if (!added || current.some((p) => passageKey(p) === passageKey(added))) return current;
    return [...current, added];
}

export function withoutPassage(list: BibelPassage[] | undefined, key: string): BibelPassage[] {
    return toPassages(list).filter((p) => passageKey(p) !== key);
}

/**
 * Reorder to `orderedKeys`. Passages missing from the list are appended, as
 * the song lists do, so a partial order can never drop one.
 */
export function reorderPassages(
    list: BibelPassage[] | undefined,
    orderedKeys: string[],
): BibelPassage[] {
    const current = toPassages(list);
    const byKey = new Map(current.map((p) => [passageKey(p), p]));
    const ordered = [...new Set(orderedKeys)]
        .map((key) => byKey.get(key))
        .filter((p): p is BibelPassage => p !== undefined);
    const placed = new Set(ordered.map(passageKey));
    return [...ordered, ...current.filter((p) => !placed.has(passageKey(p)))];
}

/**
 * The passages a set of selected verses makes: each unbroken run one passage,
 * so verses 1–3 and 5 become "23,1-3" and "23,5".
 */
export function passagesFromVerses(
    ref: { slug: string; chapter: number },
    verses: number[],
): BibelPassage[] {
    const sorted = [...new Set(verses)].sort((a, b) => a - b);
    const passages: BibelPassage[] = [];
    for (const verse of sorted) {
        const last = passages.at(-1);
        const end = last?.endVerse ?? last?.verse;
        if (last && end === verse - 1) {
            last.endVerse = verse;
        } else {
            passages.push({ slug: ref.slug, chapter: ref.chapter, verse });
        }
    }
    return passages;
}
