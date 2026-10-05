import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Block } from './bibel';
import { layoutChapter, versesOf } from './bibelLayout';
import { type ParallelRow, ownNumber, parallelRows, secondaryVerses } from './bibelParallel';

/** A prose chapter: one line per verse, as Menge sets prose. */
function prose(...verses: [number, string][]): Block {
    return { p: verses.map(([v, text]) => ({ s: [{ v }, text] })) };
}

function luther(...chapters: Block[][]): Block[][] {
    return chapters;
}

/** The rows as a reader would see them: Menge's verses and Luther's beside them. */
function sketch(rows: ParallelRow[]) {
    return rows.map((row) =>
        row.kind === 'heading'
            ? `# ${row.text}`
            : `${row.primary.length ? row.verses.join('+') : '—'} | ${
                  row.secondary.map((entry) => entry.verse).join('+') || '—'
              }`,
    );
}

function rowsFor(menge: Block[], book: Block[][], chapter = 1) {
    const laid = layoutChapter(menge);
    const secondary = secondaryVerses(book, chapter, versesOf(laid));
    return secondary ? parallelRows(laid, secondary) : null;
}

describe('parallelRows', () => {
    it('sets verse beside verse, under Menge’s headings', () => {
        const menge: Block[] = [{ h: 3, t: 'Der gute Hirte' }, prose([1, 'a'], [2, 'b'])];
        const rows = rowsFor(menge, luther([prose([1, 'A'], [2, 'B'])]))!;
        expect(sketch(rows)).toEqual(['# Der gute Hirte', '1 | 1', '2 | 2']);
        const verse = rows[1] as Extract<ParallelRow, { kind: 'verse' }>;
        expect(verse.secondary[0].text).toBe('A');
    });

    it('marks a verse the second text lacks, and slots in one only it has', () => {
        const menge = [prose([1, 'a'], [2, 'b'], [4, 'd'])];
        const book = luther([prose([1, 'A'], [3, 'C'], [4, 'D'], [5, 'E'])]);
        expect(sketch(rowsFor(menge, book)!)).toEqual([
            '1 | 1',
            '2 | —',
            '— | 3',
            '4 | 4',
            '— | 5',
        ]);
    });

    it('puts a verse before Menge’s first under the opening heading', () => {
        const menge: Block[] = [{ h: 2, t: 'Titel' }, prose([2, 'b'])];
        expect(sketch(rowsFor(menge, luther([prose([1, 'A'], [2, 'B'])]))!)).toEqual([
            '# Titel',
            '— | 1',
            '2 | 2',
        ]);
    });

    it('lets a verse Menge leaves wordless ride with the next', () => {
        const menge: Block[] = [{ p: [{ s: [{ v: 1 }, 'a'] }, { s: [{ v: 2 }, { v: 3 }, 'bc'] }] }];
        const book = luther([prose([1, 'A'], [2, 'B'], [3, 'C'])]);
        expect(sketch(rowsFor(menge, book)!)).toEqual(['1 | 1', '2+3 | 2+3']);
    });

    it('keeps a verse that runs over poetry lines together, line by line', () => {
        const menge: Block[] = [
            {
                p: [
                    { s: [{ v: 1 }, 'Der HERR ist mein Hirt:'] },
                    { s: ['mir mangelt nichts.', { v: 2 }, 'Er weidet mich'], i: 1 },
                ],
                q: 1,
            },
        ];
        const rows = rowsFor(menge, luther([prose([1, 'A'], [2, 'B'])]))!;
        expect(sketch(rows)).toEqual(['1 | 1', '2 | 2']);
        const first = rows[0] as Extract<ParallelRow, { kind: 'verse' }>;
        expect(first.primary.map((piece) => [piece.poetry, piece.indent])).toEqual([
            [true, 0],
            [true, 1],
        ]);
        const second = rows[1] as Extract<ParallelRow, { kind: 'verse' }>;
        // Verse 2 starts mid-line: its share of that line is its own piece.
        expect(second.primary).toHaveLength(1);
        expect(second.primary[0].segments[0]).toEqual({ kind: 'verse', verse: 2 });
    });

    it('gives a repeated verse number its counterpart only once', () => {
        const menge = [prose([1, 'a'], [2, 'b'], [1, 'a2'])];
        expect(sketch(rowsFor(menge, luther([prose([1, 'A'], [2, 'B'])]))!)).toEqual([
            '1 | 1',
            '2 | 2',
            '1 | —',
        ]);
    });

    it('has nothing to set beside a chapter the second text does not have', () => {
        expect(rowsFor([prose([1, 'a'])], luther([prose([1, 'A'])]), 2)).toBeNull();
    });
});

describe('secondaryVerses', () => {
    // Joel as the Lutherbibel counts it: Menge's chapter 3 is the end of
    // Luther's 2, and Menge's 4 is Luther's 3 — each verse noting its place.
    const joel = luther(
        [prose([1, 'eins'])],
        [prose([27, 'Ende'], [28, '[3:1] Geist'], [29, '[3:2] Knechte'])],
        [prose([1, '[4:1] Denn siehe'], [2, '[4:2] Völker'], [3, '[4:3] Los'])],
    );

    it('follows the source’s place notes where they fit Menge better', () => {
        const verses = secondaryVerses(joel, 3, [1, 2])!;
        expect([...verses.keys()]).toEqual([1, 2]);
        expect(verses.get(1)).toEqual({
            verse: 1,
            own: { chapter: 2, verse: 28 },
            text: 'Geist',
        });
        expect(ownNumber(verses.get(1)!, 3)).toBe('2,28');
    });

    it('finds a chapter Luther does not number at all', () => {
        const verses = secondaryVerses(joel, 4, [1, 2])!;
        expect(verses.get(2)?.text).toBe('Völker');
        expect(ownNumber(verses.get(2)!, 4)).toBe('3,2');
    });

    it('keeps the plain chapter on a tie, and shows no number of its own there', () => {
        const book = luther([prose([1, '[2:1] A'], [2, 'B'])], [prose([1, 'C'])]);
        const verses = secondaryVerses(book, 1, [1, 2])!;
        expect(verses.get(1)?.text).toBe('A');
        expect(ownNumber(verses.get(1)!, 1)).toBeNull();
    });

    it('is null for a chapter with nothing in it', () => {
        expect(secondaryVerses(joel, 9, [1])).toBeNull();
    });
});

// The shipped texts, to hold the alignment to the books it was made for.
function book(translation: string, slug: string): Block[][] {
    const path = resolve(__dirname, '../../public/bibeltext', translation, `${slug}.json`);
    return (JSON.parse(readFileSync(path, 'utf8')) as { chapters: Block[][] }).chapters;
}

describe('the shipped Menge and Luther', () => {
    function gaps(slug: string, chapter: number) {
        const laid = layoutChapter(book('menge', slug)[chapter - 1]);
        const rows = parallelRows(
            laid,
            secondaryVerses(book('luther1912', slug), chapter, versesOf(laid))!,
        ).filter((row) => row.kind === 'verse');
        return {
            mengeOnly: rows.filter((row) => row.secondary.length === 0).length,
            lutherOnly: rows.filter((row) => row.primary.length === 0).length,
        };
    }

    it('sets Joel 3 and 4 beside Luther’s 2,28–32 and his chapter 3', () => {
        expect(gaps('joel', 3)).toEqual({ mengeOnly: 0, lutherOnly: 0 });
        expect(gaps('joel', 4)).toEqual({ mengeOnly: 0, lutherOnly: 0 });
    });

    it('sets Maleachi 3 beside Luther’s 3 and 4', () => {
        expect(gaps('maleachi', 3)).toEqual({ mengeOnly: 0, lutherOnly: 0 });
    });

    it('meets a plain chapter verse for verse', () => {
        expect(gaps('psalm', 23)).toEqual({ mengeOnly: 0, lutherOnly: 0 });
        expect(gaps('johannes', 3)).toEqual({ mengeOnly: 0, lutherOnly: 0 });
    });
});
