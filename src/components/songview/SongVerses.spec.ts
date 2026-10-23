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
        .findAll('.verse-block')
        .map((block) => block.text())
        .join('\n');
}

// Die Absätze einer Strophe, jeweils mit der Überschrift, unter der sie stehen.
function absaetze(strophe: string) {
    return mount(SongVerses, { props: { strophes: [{ text: strophe }] } })
        .findAll('.verse-block')
        .map((block) => {
            const label = block.find('.verse-label');
            const text = block.text();
            return label.exists()
                ? { label: label.text(), text: text.slice(label.text().length).trim() }
                : { text };
        });
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

// „Refrain" auf einer eigenen Zeile ist die Überschrift des Absatzes darunter,
// so wie der Druck ihn kursiv über den Refrain setzt (Lied 40).
describe('SongVerses – Refrain', () => {
    it('setzt den Refrain unter seiner Überschrift ab (Lied 40, Strophe 3)', () => {
        expect(
            absaetze(
                'Gib uns das, was wir brauchen, gib uns heut unser Brot.\n' +
                    'Und vergib uns den Aufstand gegen dich und dein Gebot.\n\n' +
                    'Refrain\nVater, unser Vater, alle Ehre deinem Namen.\n' +
                    'Vater, unser Vater, bis ans Ende der Zeiten. Amen.',
            ),
        ).toEqual([
            {
                text:
                    'Gib uns das, was wir brauchen, gib uns heut unser Brot. ' +
                    'Und vergib uns den Aufstand gegen dich und dein Gebot.',
            },
            {
                label: 'Refrain',
                text:
                    'Vater, unser Vater, alle Ehre deinem Namen. ' +
                    'Vater, unser Vater, bis ans Ende der Zeiten. Amen.',
            },
        ]);
    });

    it('erkennt die Überschrift auch mit Doppelpunkt und ohne Leerzeile davor', () => {
        expect(absaetze('Strophe\nRefrain: \nKehrvers eins\nKehrvers zwei')).toEqual([
            { text: 'Strophe' },
            { label: 'Refrain', text: 'Kehrvers eins Kehrvers zwei' },
        ]);
    });

    it('lässt Worte auf der Überschriftzeile beim Refrain stehen', () => {
        expect(absaetze('Refrain: Kleiner Stern ...\n\nScheinst so hell ...')).toEqual([
            { label: 'Refrain', text: 'Kleiner Stern ...' },
            { text: 'Scheinst so hell ...' },
        ]);
    });

    it('hält ein Refrain im Satz für Text', () => {
        expect(absaetze('Ich habe das Lied\nganz ohne Refrain gemacht')).toEqual([
            { text: 'Ich habe das Lied ganz ohne Refrain gemacht' },
        ]);
    });
});

// Die Strophen, die dieser Gottesdienst nicht singt, bleiben stehen – sie
// treten nur zurück. Gezählt wird dabei nach der gedruckten Nummer.
describe('SongVerses – Strophen dieses Gottesdienstes', () => {
    const dreiStrophen = [{ text: 'Erste' }, { text: 'Zweite' }, { text: 'Dritte' }];

    function zeilen(sungVerses?: number[] | null) {
        return mount(SongVerses, { props: { strophes: dreiStrophen, sungVerses } }).findAll(
            '.verse-row',
        );
    }

    it('lässt ohne Auswahl jede Strophe stehen wie bisher', () => {
        expect(zeilen().every((zeile) => !zeile.classes('verse-unsung'))).toBe(true);
        expect(zeilen(null).every((zeile) => !zeile.classes('verse-unsung'))).toBe(true);
    });

    it('nimmt die nicht gewählten Strophen zurück, ohne sie zu verstecken', () => {
        const reihen = zeilen([1, 3]);
        expect(reihen.map((zeile) => zeile.classes('verse-unsung'))).toEqual([false, true, false]);
        // Verschwunden ist nichts: der Text steht weiter da.
        expect(reihen[1].text()).toContain('Zweite');
    });

    it('sagt Vorlesegeräten, was das blasse Grau bedeutet', () => {
        const reihen = zeilen([1, 3]);
        expect(reihen[1].find('.sr-only').exists()).toBe(true);
        expect(reihen[0].find('.sr-only').exists()).toBe(false);
    });
});
