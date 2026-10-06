import { type ParsedBibelRef, parseReference } from '@/utils/bibelRef';
import { getIsoWeek } from '@/utils/songOfTheWeek';

/**
 * The Vers der Woche: one well-known verse for each ISO week, the same all
 * week and the same week every year.
 *
 * Only references are kept here; the wording is read from the Menge text the
 * reader opens, so the card and the chapter can never disagree. The order
 * follows the calendar where the calendar holds still — a verse for the new
 * year in week 1, Advent and Christmas in the last weeks — and is otherwise
 * free: Easter moves, the weeks do not.
 */
export const VERSES_OF_THE_WEEK: readonly string[] = [
    'Hebräer 13,8', // 1 — Neujahr
    'Psalm 23,1',
    'Johannes 3,16',
    'Jesaja 43,1',
    'Psalm 27,1',
    'Matthäus 5,14',
    'Sprüche 3,5',
    'Psalm 139,5',
    'Micha 6,8',
    'Psalm 51,12', // 10
    'Jesaja 53,5',
    'Matthäus 11,28',
    'Johannes 10,11',
    'Johannes 11,25',
    'Johannes 14,6',
    'Psalm 118,24',
    'Römer 8,28',
    'Johannes 15,5',
    'Jesaja 40,31',
    'Johannes 14,27', // 20
    'Apostelgeschichte 1,8',
    'Psalm 103,2',
    'Matthäus 7,7',
    'Römer 12,12',
    'Psalm 121,2',
    'Philipper 4,13',
    'Matthäus 6,33',
    'Galater 5,22',
    'Psalm 119,105',
    '1. Korinther 13,13', // 30
    'Jeremia 29,11',
    'Epheser 2,8',
    'Psalm 46,2',
    '2. Korinther 12,9',
    'Johannes 8,12',
    'Lukas 19,10',
    '1. Petrus 5,7',
    'Römer 8,38-39',
    'Psalm 91,11',
    '2. Korinther 5,17', // 40
    'Klagelieder 3,22-23',
    '1. Mose 1,1',
    'Prediger 3,1',
    '1. Johannes 4,16',
    'Psalm 90,12',
    'Offenbarung 21,4',
    'Matthäus 28,20',
    'Jesaja 41,10', // 48 — Advent
    'Philipper 4,4',
    'Jesaja 9,5',
    'Johannes 1,14',
    'Lukas 2,10-11', // 52 — Weihnachten
    'Matthäus 5,9', // 53, in the years that have one
];

export interface VerseOfTheWeek {
    /** As written in the list, e.g. "Römer 8,38-39". */
    label: string;
    ref: ParsedBibelRef & { verse: number };
}

/** The verse for the week `reference` falls in, or null if the list is broken. */
export function pickVerseOfTheWeek(
    reference: Date,
    verses: readonly string[] = VERSES_OF_THE_WEEK,
): VerseOfTheWeek | null {
    if (verses.length === 0) return null;
    const { week } = getIsoWeek(reference);
    const label = verses[(week - 1) % verses.length];
    const ref = parseReference(label);
    if (!ref?.verse) return null;
    return { label, ref: { ...ref, verse: ref.verse } };
}

/** The verse numbers the pick covers: one, or a short run. */
export function versesOf(ref: VerseOfTheWeek['ref']): number[] {
    const last = ref.endVerse ?? ref.verse;
    return Array.from({ length: last - ref.verse + 1 }, (_, i) => ref.verse + i);
}
