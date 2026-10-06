import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { Block } from './bibel';
import {
    type Bibelstelle,
    type BibelstellenData,
    bibelstellenFor,
    groupByLine,
    isBibelstellenData,
    stelleVerses,
    titleKey,
    verseLabel,
} from './bibelstellen';

function book(translation: string, slug: string): Block[][] {
    const path = `public/bibeltext/${translation}/${slug}.json`;
    return (JSON.parse(readFileSync(path, 'utf-8')) as { chapters: Block[][] }).chapters;
}

const data: BibelstellenData = {
    byText: {
        '3': [
            {
                ref: 'Psalm 127,3',
                note: 'Kinder als Gabe',
                at: ['psalm', 127, 3],
            },
        ],
        '96': [{ ref: 'Matthäus 21,1-11', note: 'Einzug in Jerusalem', at: ['matthaeus', 21, 1] }],
    },
    byTitle: { 'ich bin ein kind auf erden': '3' },
};

describe('bibelstellenFor', () => {
    it('finds the passages by the text id', () => {
        expect(bibelstellenFor(data, { textId: '96', titel: 'egal' })[0].ref).toBe(
            'Matthäus 21,1-11',
        );
    });

    it('falls back to the title for songs synced before textId', () => {
        expect(bibelstellenFor(data, { titel: 'Ich bin ein Kind auf Erden' })).toHaveLength(1);
    });

    it('prefers the text id over a title that happens to match', () => {
        expect(bibelstellenFor(data, { textId: '7', titel: 'Ich bin ein Kind auf Erden' })).toEqual(
            [],
        );
    });

    it('returns nothing for a song without references', () => {
        expect(bibelstellenFor(data, { titel: 'Unbekannt' })).toEqual([]);
    });
});

describe('titleKey', () => {
    it('ignores case, punctuation and soft hyphens', () => {
        expect(titleKey('Lo­be den Herren, den mächtigen König!')).toBe(
            'lobe den herren den mächtigen könig',
        );
    });
});

describe('verseLabel', () => {
    it('prints the bare verse within one chapter', () => {
        expect(
            verseLabel(
                [
                    [21, 1, 'a'],
                    [21, 2, 'b'],
                ],
                1,
            ),
        ).toBe('2');
    });

    it('names the chapter once the passage crosses one', () => {
        expect(
            verseLabel(
                [
                    [3, 24, 'a'],
                    [4, 1, 'b'],
                ],
                1,
            ),
        ).toBe('4,1');
    });
});

describe('groupByLine', () => {
    const stelle = (ref: string, strophe?: number): Bibelstelle => ({
        ref,
        note: '',
        at: ['psalm', 23, 1],
        ...(strophe ? { line: { strophe, text: '…' } } : {}),
    });

    it('puts the passages with a line first, in strophe order', () => {
        const { toLines, whole } = groupByLine([
            stelle('a'),
            stelle('b', 3),
            stelle('c', 1),
            stelle('d'),
        ]);
        expect(toLines.map((s) => s.ref)).toEqual(['c', 'b']);
        expect(whole.map((s) => s.ref)).toEqual(['a', 'd']);
    });
});

describe('stelleVerses', () => {
    const psalm23: Bibelstelle = { ref: 'Psalm 23,1-2', note: '', at: ['psalm', 23, 1] };

    it('reads the passage from the book, in the translation given', () => {
        const menge = stelleVerses(psalm23, book('menge', 'psalm'));
        expect(menge.map(([c, v]) => `${c},${v}`)).toEqual(['23,1', '23,2']);
        expect(menge[0][2]).toContain('mein Hirt');

        const luther = stelleVerses(psalm23, book('luther1912', 'psalm'));
        expect(luther[0][2]).toContain('mein Hirte');
    });

    it('runs across chapters', () => {
        const schoepfung: Bibelstelle = {
            ref: '1. Mose 1,31-2,1',
            note: '',
            at: ['1-mose', 1, 31],
        };
        expect(
            stelleVerses(schoepfung, book('menge', '1-mose')).map(([c, v]) => `${c},${v}`),
        ).toEqual(['1,31', '2,1']);
    });
});

describe('isBibelstellenData', () => {
    it('takes the file as uploaded, and nothing else', () => {
        expect(isBibelstellenData({ byText: {}, byTitle: {} })).toBe(true);
        expect(isBibelstellenData({ byText: {} })).toBe(false);
        expect(isBibelstellenData('<html>')).toBe(false);
        expect(isBibelstellenData(null)).toBe(false);
    });
});
