import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BIBEL_SAMPLES, type BibelSample } from '@/components/onboarding/bibelCompare';

import type { Block, Segment } from '@/utils/bibel';
import { versesRefLabel } from '@/utils/bibelVerses';

/**
 * The passages the comparison quotes are typed into the bundle, so nothing but this
 * keeps them true to the text a reader then gets. It reads the files the app ships.
 */

function chapterOf(translation: string, { slug, chapter }: BibelSample): Block[] {
    const file = `public/bibeltext/${translation}/${slug}.json`;
    const { chapters } = JSON.parse(readFileSync(file, 'utf8')) as { chapters: Block[][] };
    return chapters[chapter - 1];
}

/** Every segment of the chapter, each with the verse it belongs to. */
function segmentsOf(blocks: Block[]): { verse: number; segment: Segment }[] {
    const found: { verse: number; segment: Segment }[] = [];
    let verse = 0;
    for (const block of blocks) {
        if (!('p' in block)) continue;
        for (const line of block.p) {
            for (const segment of line.s) {
                if (typeof segment === 'object' && 'v' in segment) verse = segment.v;
                else found.push({ verse, segment });
            }
        }
    }
    return found;
}

/** The words of the verses, without the notes, and with spacing out of the question. */
function wordsOf(blocks: Block[], verses: number[]): string {
    return segmentsOf(blocks)
        .filter(({ verse }) => verses.includes(verse))
        .map(({ segment }) => {
            if (typeof segment === 'string') return segment;
            return 'e' in segment ? segment.e : '';
        })
        .join('')
        .replace(/\s+/g, '');
}

const squeezed = (text: string) => text.replace(/\s+/g, '');

describe.each(
    BIBEL_SAMPLES.map((sample) => [versesRefLabel(sample, sample.verses), sample] as const),
)('%s', (_label, sample) => {
    it('quotes Luther word for word', () => {
        const chapter = chapterOf('luther1912', sample);
        expect(squeezed(sample.luther)).toBe(wordsOf(chapter, sample.verses));
    });

    it('quotes Menge word for word', () => {
        const chapter = chapterOf('menge', sample);
        expect(squeezed(sample.menge)).toBe(wordsOf(chapter, sample.verses));
    });

    it('gives the heading Menge sets right over the passage', () => {
        if (!sample.mengeHeading) return;
        const chapter = chapterOf('menge', sample);
        const firstVerse = chapter.findIndex(
            (block) =>
                'p' in block &&
                block.p.some((line) =>
                    line.s.some(
                        (segment) =>
                            typeof segment === 'object' &&
                            'v' in segment &&
                            segment.v === sample.verses[0],
                    ),
                ),
        );
        expect(chapter[firstVerse - 1]).toMatchObject({ t: sample.mengeHeading });
    });

    it('gives Menge’s note on the word it stands behind', () => {
        if (!sample.mengeNote) return;
        const segments = segmentsOf(chapterOf('menge', sample));
        const at = segments.findIndex(
            ({ verse, segment }) =>
                sample.verses.includes(verse) &&
                typeof segment === 'object' &&
                'n' in segment &&
                segment.n === sample.mengeNote!.text,
        );
        expect(at).toBeGreaterThan(0);
        expect(segments[at - 1].segment).toEqual(
            expect.stringMatching(new RegExp(`${sample.mengeNote.word}$`)),
        );
    });
});

describe('the passages', () => {
    it('are cited as the rest of the app cites a passage', () => {
        expect(BIBEL_SAMPLES.map((sample) => versesRefLabel(sample, sample.verses))).toEqual([
            'Psalm 23,1-3',
            'Johannes 3,16',
        ]);
    });
});
