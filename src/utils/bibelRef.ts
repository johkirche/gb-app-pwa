import { BIBEL_BOOKS, type BibelBook } from '@/utils/bibel';

/**
 * Reading a Bible reference the way a German reader writes one: "Joh 3,16",
 * "1. Mose 1,1-3", "1Kor 13", "Ps 23", "psalm23", "Römer 8,28". Used for the
 * cross-references in Menge's footnotes and for a reference typed into search.
 */

export interface ParsedBibelRef {
    slug: string;
    chapter: number;
    /** Absent for a whole chapter. */
    verse?: number;
    /** The last verse of a range within the chapter. */
    endVerse?: number;
}

// The usual German abbreviations, beyond each book's own name. Keys are
// normalised (see norm): lower case, no dots or spaces, umlauts folded.
const ALIASES: Record<string, string[]> = {
    '1. Mose': ['1mo', '1mos', 'gen', 'genesis'],
    '2. Mose': ['2mo', '2mos', 'ex', 'exodus'],
    '3. Mose': ['3mo', '3mos', 'lev', 'levitikus'],
    '4. Mose': ['4mo', '4mos', 'num', 'numeri'],
    '5. Mose': ['5mo', '5mos', 'dtn', 'deuteronomium'],
    Josua: ['jos'],
    Richter: ['ri'],
    Rut: ['ruth'],
    '1. Samuel': ['1sam', '1sa'],
    '2. Samuel': ['2sam', '2sa'],
    '1. Könige': ['1kon', '1ko', '1kg'],
    '2. Könige': ['2kon', '2ko', '2kg'],
    '1. Chronik': ['1chr', '1ch'],
    '2. Chronik': ['2chr', '2ch'],
    Esra: ['esr'],
    Nehemia: ['neh'],
    Ester: ['est', 'esther'],
    Hiob: ['hi', 'ijob', 'job'],
    Psalm: ['ps', 'psalmen', 'psa'],
    Sprüche: ['spr'],
    Prediger: ['pred', 'koh', 'kohelet'],
    Hohelied: ['hld', 'hoheslied'],
    Jesaja: ['jes'],
    Jeremia: ['jer'],
    Klagelieder: ['klgl', 'klg'],
    Hesekiel: ['hes', 'ez', 'ezechiel'],
    Daniel: ['dan', 'da'],
    Hosea: ['hos'],
    Joel: ['joe'],
    Amos: ['am'],
    Obadja: ['obd', 'ob'],
    Jona: ['jon'],
    Micha: ['mi'],
    Nahum: ['nah'],
    Habakuk: ['hab'],
    Zephanja: ['zef', 'zeph', 'zefanja'],
    Haggai: ['hag'],
    Sacharja: ['sach'],
    Maleachi: ['mal'],
    Matthäus: ['mt', 'mat', 'matth'],
    Markus: ['mk', 'mar', 'mark'],
    Lukas: ['lk', 'luk'],
    Johannes: ['joh', 'jh'],
    Apostelgeschichte: ['apg'],
    Römer: ['rom', 'ro', 'rm'],
    '1. Korinther': ['1kor', '1ko'],
    '2. Korinther': ['2kor'],
    Galater: ['gal'],
    Epheser: ['eph'],
    Philipper: ['phil', 'php'],
    Kolosser: ['kol'],
    '1. Thessalonicher': ['1thess', '1th', '1thes'],
    '2. Thessalonicher': ['2thess', '2th', '2thes'],
    '1. Timotheus': ['1tim', '1ti'],
    '2. Timotheus': ['2tim', '2ti'],
    Titus: ['tit'],
    Philemon: ['phlm', 'phm'],
    Hebräer: ['hebr', 'heb'],
    Jakobus: ['jak'],
    '1. Petrus': ['1petr', '1pe', '1pt'],
    '2. Petrus': ['2petr', '2pe', '2pt'],
    '1. Johannes': ['1joh', '1jo'],
    '2. Johannes': ['2joh', '2jo'],
    '3. Johannes': ['3joh', '3jo'],
    Judas: ['jud'],
    Offenbarung: ['offb', 'off', 'apk', 'offenb'],
};

function norm(text: string): string {
    return text
        .toLowerCase()
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ß/g, 'ss')
        .replace(/[.\s]/g, '');
}

const byKey = new Map<string, BibelBook>();
for (const book of BIBEL_BOOKS) {
    byKey.set(norm(book.name), book);
    for (const alias of ALIASES[book.name] ?? []) {
        // An abbreviation two books could claim ("1ko") goes to the first.
        if (!byKey.has(alias)) byKey.set(alias, book);
    }
}

/** The book a name or abbreviation stands for, or undefined. */
export function findBookByName(name: string): BibelBook | undefined {
    const key = norm(name);
    if (!key) return undefined;
    const exact = byKey.get(key);
    if (exact) return exact;
    // A longer start of a book's name ("Offenba", "Philipp") is still that
    // book, as long as only one book begins that way.
    if (key.length < 3) return undefined;
    const matches = BIBEL_BOOKS.filter((book) => norm(book.name).startsWith(key));
    return matches.length === 1 ? matches[0] : undefined;
}

// Book (which may begin with a number), chapter, and optionally ,verse or
// :verse and a -range. "1. Mose 1,1-3", "Joh 3:16", "ps23".
const REFERENCE =
    /^\s*((?:[1-5]\s*\.?\s*)?[a-zäöüß][a-zäöüß.\s]*?)\s*(\d+)(?:\s*[,:]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i;

/** A reference read from text, or null when it is none — or names a passage
 *  the book does not have. */
export function parseReference(input: string): ParsedBibelRef | null {
    const m = REFERENCE.exec(input);
    if (!m) return null;
    const book = findBookByName(m[1]);
    if (!book) return null;

    // In a book of one chapter, "Judas 3" means verse 3.
    let chapter = Number(m[2]);
    let verse = m[3] ? Number(m[3]) : undefined;
    const endVerse = m[4] ? Number(m[4]) : undefined;
    if (book.chapters === 1 && verse === undefined && chapter > 1) {
        verse = chapter;
        chapter = 1;
    }
    if (chapter < 1 || chapter > book.chapters) return null;

    const ref: ParsedBibelRef = { slug: book.slug, chapter };
    if (verse !== undefined) ref.verse = verse;
    if (endVerse !== undefined && verse !== undefined && endVerse > verse) ref.endVerse = endVerse;
    return ref;
}

/**
 * Every reference inside a run of text, with where it stands — for turning
 * the references in a footnote into links. "vgl. Ps 130,8; Jes 7,14" yields two.
 */
export function findReferences(
    text: string,
): { start: number; end: number; ref: ParsedBibelRef }[] {
    const found: { start: number; end: number; ref: ParsedBibelRef }[] = [];
    const candidate =
        /(?:[1-5]\.?\s?)?[A-ZÄÖÜ][a-zäöüß]{0,16}\.?\s?\d+(?:,\d+(?:\s?[-–]\s?\d+)?)?/g;
    for (const m of text.matchAll(candidate)) {
        const ref = parseReference(m[0]);
        if (ref) found.push({ start: m.index, end: m.index + m[0].length, ref });
    }
    return found;
}
