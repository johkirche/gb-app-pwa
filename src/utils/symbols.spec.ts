import { describe, expect, it } from 'vitest';

import { symbolLabel, symbolOrder, toSymbols } from '@/utils/symbols';

describe('symbolLabel', () => {
    it('drops the series from the title Directus made of the file name', () => {
        expect(symbolLabel({ id: 'a', title: 'Gesangbuch Symbole V06 23 Taube' })).toBe('Taube');
        expect(
            symbolLabel({ id: 'a', title: 'Gesangbuch Symbole V06 25 Heilige Drei Koenige' }),
        ).toBe('Heilige Drei Koenige');
    });

    it('takes a title written by hand as it stands', () => {
        expect(symbolLabel({ id: 'a', title: 'Drei Vögel' })).toBe('Drei Vögel');
    });

    it('falls back on the download name when there is no title', () => {
        expect(
            symbolLabel({ id: 'a', filename_download: 'Gesangbuch-Symbole_v06_8_Lutherrose.svg' }),
        ).toBe('Lutherrose');
    });

    it('never names a symbol with nothing', () => {
        expect(symbolLabel({ id: 'a', title: '12' })).toBe('12');
        expect(symbolLabel({ id: 'a' })).toBe('Symbol');
    });
});

describe('symbolOrder', () => {
    it('reads the number in the series, not the version', () => {
        expect(
            symbolOrder({ id: 'a', filename_download: 'Gesangbuch-Symbole_v06_23_Taube.svg' }),
        ).toBe(23);
    });

    it('puts a symbol without one last', () => {
        expect(symbolOrder({ id: 'a', filename_download: 'Taube.svg' })).toBe(Infinity);
    });
});

describe('toSymbols', () => {
    it('lists the folder in the book’s order, numbers compared as numbers', () => {
        const symbols = toSymbols([
            { id: 'c', filename_download: 'Gesangbuch-Symbole_v06_10_Krippe_im_Stall.svg' },
            { id: 'x', title: 'Anker', filename_download: 'anker.svg' },
            {
                id: 'a',
                filename_download: 'Gesangbuch-Symbole_v06_1_Drei_Voegel.svg',
                filesize: '1200',
            },
            { id: 'b', filename_download: 'Gesangbuch-Symbole_v06_2_Stadt_mit_Kreuz.svg' },
        ]);
        expect(symbols.map((s) => s.id)).toEqual(['a', 'b', 'c', 'x']);
        expect(symbols[0]).toEqual({ id: 'a', label: 'Drei Voegel', order: 1, filesize: 1200 });
    });
});
