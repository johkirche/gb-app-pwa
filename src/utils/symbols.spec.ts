import { describe, expect, it } from 'vitest';

import { SYMBOL_NAMES } from '@/config/symbols';
import { symbolLabel, symbolOrder, symbolSlug, toSymbols } from '@/utils/symbols';

/** The set as the print run named it: v06, 1 to 32. */
const PRINT_RUN = [
    '1_Drei_Voegel',
    '2_Stadt_mit_Kreuz',
    '3_Stern_ueber_Stadt',
    '4_Arche_Noah',
    '5_Aehren',
    '6_Kerze',
    '7_Leuchtturm',
    '8_Lutherrose',
    '9_Welle',
    '10_Krippe_im_Stall',
    '11_Fische',
    '12_Drei_Kreuze',
    '13_Menora',
    '14_Altar_Gott_ist_Liebe',
    '15_Engel_mit_Schwert',
    '16_Flamme',
    '17_Hirte_mit_Schaf',
    '18_Baum',
    '19_Tannenbaum_mit_Stern',
    '20_Kreuz_mit_Strahlen',
    '21_Segnende_Hand',
    '22_Buch_Alpha_Omega',
    '23_Taube',
    '24_Anker',
    '25_Heilige_Drei_Koenige',
    '26_Sonne_Mond_Sterne',
    '27_Betende_Haende',
    '28_Betender_Engel',
    '29_Schmetterling',
    '30_Kirche_im_Wald',
    '31_Sonnenblume',
    '32_Maria_mit_Kind',
].map((name) => `Gesangbuch-Symbole_v06_${name}.svg`);

describe('symbolLabel', () => {
    it('names every symbol of the print run from the list', () => {
        for (const filename_download of PRINT_RUN) {
            const slug = symbolSlug({ id: 'a', filename_download });
            expect(SYMBOL_NAMES[slug], filename_download).toBeDefined();
        }
    });

    it('takes the list’s name over the file’s', () => {
        expect(
            symbolLabel({ id: 'a', filename_download: 'Gesangbuch-Symbole_v06_1_Drei_Voegel.svg' }),
        ).toBe('Drei Vögel');
    });

    it('finds the name in the title Directus capitalised, without a download name', () => {
        expect(symbolLabel({ id: 'a', title: 'Gesangbuch Symbole V06 10 Krippe Im Stall' })).toBe(
            'Krippe im Stall',
        );
    });

    it('keeps the names through a new version and a new number', () => {
        expect(
            symbolLabel({ id: 'a', filename_download: 'Gesangbuch-Symbole_v07_40_Taube.svg' }),
        ).toBe('Taube');
    });

    it('names a symbol the list does not know by a title written by hand', () => {
        expect(
            symbolLabel({
                id: 'a',
                title: 'Regenbogen über dem Meer',
                filename_download: 'Gesangbuch-Symbole_v06_33_Regenbogen.svg',
            }),
        ).toBe('Regenbogen über dem Meer');
    });

    it('and by its file name otherwise', () => {
        expect(
            symbolLabel({
                id: 'a',
                title: 'Gesangbuch Symbole V06 33 Regenbogen',
                filename_download: 'Gesangbuch-Symbole_v06_33_Regenbogen.svg',
            }),
        ).toBe('Regenbogen');
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
            { id: 'x', title: 'Anker von Hand', filename_download: 'anker.svg' },
            {
                id: 'a',
                filename_download: 'Gesangbuch-Symbole_v06_1_Drei_Voegel.svg',
            },
            { id: 'b', filename_download: 'Gesangbuch-Symbole_v06_2_Stadt_mit_Kreuz.svg' },
        ]);
        expect(symbols.map((s) => s.id)).toEqual(['a', 'b', 'c', 'x']);
        expect(symbols[0]).toEqual({ id: 'a', label: 'Drei Vögel', order: 1 });
    });
});
