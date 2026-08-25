import { mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SongVerses from '@/components/songview/SongVerses.vue';

// Das Zentrieren misst die gesetzten Zeilen. Dafür braucht es einen
// ResizeObserver und Range.getClientRects, die jsdom beide nicht mitbringt –
// für den Text, um den es hier geht, ist gemessen ohnehin nichts.
const ohneMessung = Range.prototype.getClientRects;

beforeEach(() => {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

afterEach(() => {
    Range.prototype.getClientRects = ohneMessung;
    vi.unstubAllGlobals();
});

// Der gesetzte Strophentext, so wie er im Absatz steht – die Umbrüche darin
// sind genau die, die die Strophe behalten hat.
function gesetzt(strophe: string): string {
    return mount(SongVerses, { props: { strophes: [{ text: strophe }] } })
        .get('.verse-text')
        .text();
}

describe('SongVerses – Umbrüche der Erfassung', () => {
    it('setzt die Singzeilen fortlaufend, wie der Druck sie setzt', () => {
        expect(
            gesetzt(
                'Ins tiefste Erdendunkel\nbringt es der Liebe Licht;\n' +
                    'das helle Sterngefunkel\nweckt unsre Zuversicht.',
            ),
        ).toBe(
            'Ins tiefste Erdendunkel bringt es der Liebe Licht; ' +
                'das helle Sterngefunkel weckt unsre Zuversicht.',
        );
    });

    it('behält die Leerzeile, mit der ein Kehrvers abgesetzt ist', () => {
        expect(gesetzt('Erste Zeile\nzweite Zeile\n\nKehrvers eins\nKehrvers zwei')).toBe(
            'Erste Zeile zweite Zeile\nKehrvers eins Kehrvers zwei',
        );
    });

    it('nimmt eine Leerzeile auch dann, wenn Leerzeichen darin stehen', () => {
        expect(gesetzt('Erste Zeile\n   \nKehrvers eins')).toBe('Erste Zeile\nKehrvers eins');
    });

    it('kommt mit Windows-Zeilenenden genauso zurecht', () => {
        expect(gesetzt('Erste Zeile\r\nzweite Zeile\r\n\r\nKehrvers eins')).toBe(
            'Erste Zeile zweite Zeile\nKehrvers eins',
        );
    });

    it('entfernt den Silbentrenner, den nur der Notensatz braucht', () => {
        expect(gesetzt('Ad¬vent will es\nnun wer¬den')).toBe('Advent will es nun werden');
    });
});
