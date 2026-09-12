/**
 * Which verses of a hymn are sung at one service.
 *
 * A congregation rarely sings all seven verses of a hymn: the order of service
 * names two or three, and everyone else has to know which. The selection is a
 * list of the 1-based numbers the song page prints beside the verses — not
 * indices, so a plan reads the same way the page does.
 *
 * `null` means the whole hymn. That is the default everywhere and deliberately
 * not spelled out as "all of them": a selection that happens to cover every
 * verse is the same thing as no selection at all, and storing it as a list
 * would go stale the moment a verse is added to the book.
 */
export type VerseSelection = number[] | null;

/** `[1, 2, … verseCount]` — every verse of a hymn that long. */
export function allVerseNumbers(verseCount: number): number[] {
    return Array.from({ length: Math.max(0, verseCount) }, (_, index) => index + 1);
}

/**
 * A selection in its canonical form: sorted, without duplicates, and reduced to
 * `null` wherever it means "the whole hymn" — empty, or covering every verse.
 *
 * `verseCount` is what makes the second half of that possible, so it is only
 * clamped and collapsed when the count is actually known. It is left out where
 * the song is not on this device: a selection must survive a hymn that has not
 * been synced yet rather than be cleaned away against a count of zero.
 */
export function normalizeVerseSelection(
    verses: Iterable<number> | null | undefined,
    verseCount?: number,
): VerseSelection {
    if (!verses) return null;

    const numbers = [...verses].filter(
        (number) =>
            Number.isInteger(number) &&
            number >= 1 &&
            (verseCount === undefined || number <= verseCount),
    );
    const unique = [...new Set(numbers)].sort((a, b) => a - b);

    if (unique.length === 0) return null;
    if (verseCount !== undefined && unique.length >= verseCount) return null;
    return unique;
}

/** Whether that verse is one of the ones sung. */
export function isVerseSung(selection: VerseSelection | undefined, verseNumber: number): boolean {
    return !selection || selection.includes(verseNumber);
}

/**
 * The numbers as they are read out, runs written as ranges: "1–3 und 5".
 * Consecutive verses are how a selection usually falls, and four numbers spelled
 * out where a range would do makes a list that has to be parsed rather than read.
 */
export function formatVerseNumbers(numbers: number[]): string {
    if (numbers.length === 0) return '';

    const runs: string[] = [];
    let start = numbers[0];
    let previous = start;

    for (const number of numbers.slice(1).concat(Number.NaN)) {
        if (number === previous + 1) {
            previous = number;
            continue;
        }
        // A run of two is written out — "1 und 2" is no longer than "1–2" and
        // reads as the two verses it is rather than as a span.
        runs.push(
            start === previous
                ? `${start}`
                : previous === start + 1
                  ? `${start}, ${previous}`
                  : `${start}–${previous}`,
        );
        start = number;
        previous = number;
    }

    if (runs.length === 1) return runs[0];
    return `${runs.slice(0, -1).join(', ')} und ${runs[runs.length - 1]}`;
}

/** The selection in one line: "Alle Strophen", "Strophe 3", "Strophen 1–3 und 5". */
export function formatVerseSelection(
    selection: VerseSelection | undefined,
    verseCount?: number,
): string {
    const normalized = normalizeVerseSelection(selection, verseCount);
    if (!normalized) return 'Alle Strophen';
    const word = normalized.length === 1 ? 'Strophe' : 'Strophen';
    return `${word} ${formatVerseNumbers(normalized)}`;
}
