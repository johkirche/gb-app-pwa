import { describe, expect, it } from 'vitest';

import {
    appendSuffix,
    authorFilterName,
    buildFooter,
    buildFooterLines,
    formatAuthorEntry,
    formatAuthorYears,
    formatYearRange,
} from '@/utils/authorFormat';

describe('formatYearRange (Issue #18)', () => {
    it('Geburts- und Sterbejahr', () => {
        expect(formatYearRange(1798, 1874)).toBe('(1798–1874)');
    });
    it('nur Geburtsjahr', () => {
        expect(formatYearRange(1989, null)).toBe('(1989)');
    });
    it('nur Sterbejahr', () => {
        expect(formatYearRange(null, 1874)).toBe('(–1874)');
    });
    it('keine Jahre -> leer', () => {
        expect(formatYearRange(null, null)).toBe('');
    });
});

describe('formatYearRange mit Jahres-Präfixen (Issue #101)', () => {
    it('beide Präfixe (Lied 39, Nikolaus Decius)', () => {
        expect(formatYearRange(1485, 1546, 'um', 'nach')).toBe('(um 1485–nach 1546)');
    });
    it('nur Geburtsjahr-Präfix', () => {
        expect(formatYearRange(1500, 1561, 'um', null)).toBe('(um 1500–1561)');
    });
    it('nur Sterbejahr-Präfix', () => {
        expect(formatYearRange(1485, 1546, null, 'nach')).toBe('(1485–nach 1546)');
    });
    it('Präfix bei nur einem Jahr', () => {
        expect(formatYearRange(1500, null, 'um', null)).toBe('(um 1500)');
        expect(formatYearRange(null, 1546, null, 'nach')).toBe('(–nach 1546)');
    });
    it('Präfix ohne zugehörige Jahreszahl wird ignoriert', () => {
        expect(formatYearRange(null, 1874, 'um', null)).toBe('(–1874)');
        expect(formatYearRange(null, null, 'um', 'nach')).toBe('');
    });
    it('leere/whitespace-Präfixe erzeugen kein zusätzliches Leerzeichen', () => {
        expect(formatYearRange(1798, 1874, '', '  ')).toBe('(1798–1874)');
    });
});

describe('formatAuthorYears (Issue #101)', () => {
    it('liest geburtsjahrePrefix/sterbejahrPrefix vom Autor', () => {
        expect(
            formatAuthorYears({
                geburtsjahr: 1485,
                sterbejahr: 1546,
                geburtsjahrePrefix: 'um',
                sterbejahrPrefix: 'nach',
            }),
        ).toBe('(um 1485–nach 1546)');
    });
    it('ohne Präfixe wie bisher', () => {
        expect(formatAuthorYears({ geburtsjahr: 1798, sterbejahr: 1874 })).toBe('(1798–1874)');
    });
    it('kein Autor -> leer', () => {
        expect(formatAuthorYears(null)).toBe('');
    });
});

describe('appendSuffix (Issue #76)', () => {
    it('Suffix mit ";" -> kein Leerzeichen davor', () => {
        expect(appendSuffix('unbekannt', '; aus dem Liederschatz')).toBe(
            'unbekannt; aus dem Liederschatz',
        );
    });
    it('Suffix mit "," -> kein Leerzeichen davor', () => {
        expect(appendSuffix('unbekannt', ', weitere Angabe')).toBe('unbekannt, weitere Angabe');
    });
    it('normaler Suffix -> Leerzeichen davor', () => {
        expect(appendSuffix('Lehmann (1932–2025)', '„Bitte Gott allezeit“')).toBe(
            'Lehmann (1932–2025) „Bitte Gott allezeit“',
        );
    });
    it('führendes Leerzeichen vor Interpunktion wird getrimmt', () => {
        expect(appendSuffix('Name', '  ; mit fuehrendem Space')).toBe('Name; mit fuehrendem Space');
    });
    it('leerer/nuller Suffix lässt base unverändert', () => {
        expect(appendSuffix('Name', null)).toBe('Name');
        expect(appendSuffix('Name', '')).toBe('Name');
    });
    it('leere base -> nur Suffix (ohne führende Leerzeichen)', () => {
        expect(appendSuffix('', '; nur Suffix')).toBe('; nur Suffix');
    });
});

describe('formatAuthorEntry', () => {
    it('Name + Jahr', () => {
        expect(formatAuthorEntry({ vorname: 'Jens', nachname: 'Lehmann', geburtsjahr: 1966 })).toBe(
            'Jens Lehmann (1966)',
        );
    });
    it('Interpunktions-Suffix nach den Jahren (Issue #76)', () => {
        expect(
            formatAuthorEntry({
                nachname: 'unbekannt',
                autorSuffix: '; aus dem Liederschatz von Albert Knapp',
                geburtsjahr: 1798,
                sterbejahr: 1864,
            }),
        ).toBe('unbekannt (1798–1864); aus dem Liederschatz von Albert Knapp');
    });
    it('Prefix + Ursprungsautor', () => {
        expect(
            formatAuthorEntry({
                autorPrefix: 'nach',
                vorname: 'Max',
                nachname: 'Mustermann',
                ursprungsAutorObj: { nachname: 'Bach', geburtsjahr: 1685, sterbejahr: 1750 },
            }),
        ).toBe('nach Max Mustermann Bach (1685–1750)');
    });
});

describe('buildFooter', () => {
    it('Lied 216: melodieAutorExtraSuffix pro Lied (Issue #77)', () => {
        const lied = {
            copyright: 'Verlag Merseburger Berlin GmbH, Kassel',
            text: {
                authors: [
                    {
                        vorname: 'Eberhard',
                        nachname: 'Köhler',
                        geburtsjahr: 1927,
                        sterbejahr: 2014,
                    },
                ],
            },
            melodie: {
                authors: [
                    {
                        vorname: 'Siegfried',
                        nachname: 'Lehmann',
                        geburtsjahr: 1932,
                        sterbejahr: 2025,
                    },
                ],
            },
            melodieAutorExtraSuffix: '„Bitte Gott allezeit“',
        };
        expect(buildFooter(lied)).toBe(
            'Text: Eberhard Köhler (1927–2014)\n' +
                'Melodie: Siegfried Lehmann (1932–2025) „Bitte Gott allezeit“\n' +
                '© Verlag Merseburger Berlin GmbH, Kassel',
        );
    });

    it('ohne Extra-Suffix erscheint der Zusatz nicht (Original-Lied desselben Autors)', () => {
        const lied = {
            melodie: {
                authors: [
                    {
                        vorname: 'Siegfried',
                        nachname: 'Lehmann',
                        geburtsjahr: 1932,
                        sterbejahr: 2025,
                    },
                ],
            },
        };
        expect(buildFooter(lied)).toBe('Melodie: Siegfried Lehmann (1932–2025)');
    });

    it('Lied 102: Interpunktions-Suffix ohne führendes Leerzeichen (Issue #76)', () => {
        const lied = {
            text: {
                authors: [
                    {
                        nachname: 'unbekannt',
                        autorSuffix: '; aus dem Liederschatz von Albert Knapp (1798–1864)',
                    },
                ],
            },
            melodie: {
                authors: [{ vorname: 'Jens', nachname: 'Lehmann', geburtsjahr: 1966 }],
            },
        };
        expect(buildFooter(lied)).toBe(
            'Text: unbekannt; aus dem Liederschatz von Albert Knapp (1798–1864)\n' +
                'Melodie: Jens Lehmann (1966)',
        );
    });

    it('Lied 39: Jahres-Präfixe im Footer (Issue #101)', () => {
        const lied = {
            melodie: {
                authors: [
                    {
                        vorname: 'Nikolaus',
                        nachname: 'Decius',
                        geburtsjahr: 1485,
                        sterbejahr: 1546,
                        geburtsjahrePrefix: 'um',
                        sterbejahrPrefix: 'nach',
                    },
                ],
            },
        };
        expect(buildFooter(lied)).toBe('Melodie: Nikolaus Decius (um 1485–nach 1546)');
    });

    it('Jahres-Präfix auch am Ursprungsautor (Issue #101)', () => {
        expect(
            formatAuthorEntry({
                nachname: 'Mustermann',
                ursprungsAutorObj: {
                    nachname: 'Herman',
                    geburtsjahr: 1500,
                    sterbejahr: 1561,
                    geburtsjahrePrefix: 'um',
                },
            }),
        ).toBe('Mustermann Herman (um 1500–1561)');
    });

    it('gleicher Text- und Melodie-Autor -> "Text und Melodie:"', () => {
        const author = {
            vorname: 'Paul',
            nachname: 'Gerhardt',
            geburtsjahr: 1607,
            sterbejahr: 1676,
        };
        const lied = { text: { authors: [author] }, melodie: { authors: [author] } };
        expect(buildFooter(lied)).toBe('Text und Melodie: Paul Gerhardt (1607–1676)');
    });
});

describe('authorFilterName', () => {
    it('Vor- und Nachname ohne Jahre, Präfix und Suffix', () => {
        expect(
            authorFilterName({
                autorPrefix: 'nach',
                vorname: 'Paul',
                nachname: 'Gerhardt',
                geburtsjahr: 1607,
                autorSuffix: '; bearbeitet',
            }),
        ).toBe('Paul Gerhardt');
    });
    it('fehlender Vorname erzeugt kein führendes Leerzeichen (Issue #23)', () => {
        expect(authorFilterName({ nachname: 'unbekannt' })).toBe('unbekannt');
        expect(authorFilterName({ vorname: null, nachname: 'unbekannt' })).toBe('unbekannt');
    });
    it('ohne Namen -> leer (nicht filterbar)', () => {
        expect(authorFilterName({ autorSuffix: '; aus dem Liederschatz' })).toBe('');
        expect(authorFilterName(null)).toBe('');
    });
});

describe('buildFooterLines', () => {
    const koehler = { vorname: 'Eberhard', nachname: 'Köhler', geburtsjahr: 1927 };
    const lehmann = { vorname: 'Siegfried', nachname: 'Lehmann', geburtsjahr: 1932 };

    it('Segmente einer Zeile ergeben aneinandergehängt die Textzeile', () => {
        const lied = {
            copyright: 'Verlag Merseburger',
            text: { authors: [koehler, lehmann] },
            melodie: { authors: [lehmann], copyright: 'Melodieverlag' },
        };
        const lines = buildFooterLines(lied);
        expect(lines.map((l) => l.segments.map((s) => s.text).join(''))).toEqual(
            buildFooter(lied).split('\n'),
        );
        expect(lines.map((l) => l.kind)).toEqual(['text', 'melodie', 'copyright']);
    });

    it('jeder Autor bekommt ein eigenes Segment mit seinem Objekt', () => {
        const [textLine] = buildFooterLines({ text: { authors: [koehler, lehmann] } });
        expect(textLine.segments.map((s) => s.text)).toEqual([
            'Text: ',
            'Eberhard Köhler (1927)',
            ', ',
            'Siegfried Lehmann (1932)',
        ]);
        expect(textLine.segments.filter((s) => s.author).map((s) => s.author)).toEqual([
            koehler,
            lehmann,
        ]);
    });

    it('Label, Copyright und Extra-Suffix sind keine Autoren-Segmente', () => {
        const [line] = buildFooterLines({
            melodie: { authors: [lehmann], copyright: 'Melodieverlag' },
            melodieAutorExtraSuffix: '„Bitte Gott allezeit“',
        });
        expect(line.segments.map((s) => s.text)).toEqual([
            'Melodie: ',
            'Siegfried Lehmann (1932)',
            ' „Bitte Gott allezeit“',
            ' © Melodieverlag',
        ]);
        expect(line.segments.filter((s) => s.author)).toHaveLength(1);
    });

    it('der Ursprungsautor bleibt unklickbar – er steht in keinem Lied als Autor', () => {
        const [line] = buildFooterLines({
            text: {
                authors: [
                    {
                        vorname: 'Max',
                        nachname: 'Mustermann',
                        ursprungsAutorObj: { nachname: 'Bach', geburtsjahr: 1685 },
                    },
                ],
            },
        });
        expect(line.segments.map((s) => s.text)).toEqual([
            'Text: ',
            'Max Mustermann',
            ' Bach (1685)',
        ]);
        expect(line.segments.filter((s) => s.author).map((s) => s.text)).toEqual([
            'Max Mustermann',
        ]);
    });

    it('"Text und Melodie" trägt die Autoren einmal – dort klickbar', () => {
        const lied = { text: { authors: [koehler] }, melodie: { authors: [koehler] } };
        const [line] = buildFooterLines(lied);
        expect(line.kind).toBe('textUndMelodie');
        expect(line.segments.map((s) => s.text)).toEqual([
            'Text und Melodie: ',
            'Eberhard Köhler (1927)',
        ]);
        expect(line.segments[1].author).toBe(koehler);
    });
});
