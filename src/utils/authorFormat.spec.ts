import { describe, expect, it } from 'vitest';

import {
    appendSuffix,
    authorFilterName,
    buildFooter,
    buildFooterLines,
    formatAuthorEntry,
    formatAuthorYears,
    formatAuthors,
    formatYearRange,
    joinAuthorEntries,
    melodyCopyrightPlacement,
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

describe('joinAuthorEntries (Issue #110)', () => {
    it('normale Autoren werden mit ", " getrennt', () => {
        expect(joinAuthorEntries(['Erster Autor', 'Zweiter Autor'])).toBe(
            'Erster Autor, Zweiter Autor',
        );
    });
    it('Eintrag mit ";" bringt seinen Trenner selbst mit', () => {
        expect(joinAuthorEntries(['J. S. Bach (1685–1750)', '; Nürnberg 1676'])).toBe(
            'J. S. Bach (1685–1750); Nürnberg 1676',
        );
    });
    it('Eintrag mit "," bekommt kein zweites Komma', () => {
        expect(joinAuthorEntries(['Erster', ', Zweiter'])).toBe('Erster, Zweiter');
    });
    it('leere Einträge fallen raus', () => {
        expect(joinAuthorEntries(['Erster', '', null, 'Dritter'])).toBe('Erster, Dritter');
    });
    it('leere Liste -> leerer String', () => {
        expect(joinAuthorEntries([])).toBe('');
        expect(joinAuthorEntries(null)).toBe('');
    });
});

describe('formatAuthors', () => {
    it('Marker statt eigener Copyright-Zeile (Issue #114)', () => {
        expect(
            formatAuthors(
                [{ vorname: 'Martin', nachname: 'Göth', geburtsjahr: 1957 }],
                '(c)',
                'Verlag X',
            ),
        ).toBe('© Martin Göth (1957)\n© Verlag X');
    });
    it('gleiche Copyrights nur einmal (Lied 368, Issue #123)', () => {
        expect(
            formatAuthors(
                [{ vorname: 'Christian', nachname: 'Lahusen' }],
                'Bärenreiter-Verlag, Kassel',
                'Bärenreiter-Verlag, Kassel',
            ),
        ).toBe('Christian Lahusen\n© Bärenreiter-Verlag, Kassel');
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

    it('Alles ist an Gottes Segen: Autor-Präfix mit ";" statt Komma (Issue #110)', () => {
        const lied = {
            melodie: {
                authors: [
                    { vorname: 'Johann', nachname: 'Löhner', geburtsjahr: 1645, sterbejahr: 1705 },
                    {
                        autorPrefix: '; bei',
                        vorname: 'Johann Adam',
                        nachname: 'Hiller',
                        geburtsjahr: 1728,
                        sterbejahr: 1804,
                    },
                ],
            },
        };
        expect(buildFooter(lied)).toBe(
            'Melodie: Johann Löhner (1645–1705); bei Johann Adam Hiller (1728–1804)',
        );
    });
});

describe('buildFooter – Copyright-Marker (Issue #114)', () => {
    it('Lied 346: "©"/"(c)" setzt das Copyright vor den Autor', () => {
        const lied = {
            text: {
                authors: [
                    { vorname: 'Rolf', nachname: 'Krenzer', geburtsjahr: 1936, sterbejahr: 2007 },
                ],
                copyright: 'Rechtsnachfolge Rolf Krenzer',
            },
            melodie: {
                authors: [{ vorname: 'Martin', nachname: 'Göth', geburtsjahr: 1957 }],
                copyright: ' (C) ',
            },
        };
        expect(buildFooter(lied)).toBe(
            'Text: Rolf Krenzer (1936–2007) © Rechtsnachfolge Rolf Krenzer\n' +
                'Melodie: © Martin Göth (1957)',
        );
        lied.melodie.copyright = '©';
        expect(buildFooter(lied)).toBe(
            'Text: Rolf Krenzer (1936–2007) © Rechtsnachfolge Rolf Krenzer\n' +
                'Melodie: © Martin Göth (1957)',
        );
    });

    it('"©" am Lied gilt für Text- und Melodie-Autor', () => {
        const author = { vorname: 'Paul', nachname: 'Gerhardt' };
        expect(
            buildFooter({
                copyright: '©',
                text: { authors: [author] },
                melodie: { authors: [author] },
            }),
        ).toBe('Text und Melodie: © Paul Gerhardt');
    });
});

describe('buildFooter – Melodie-Copyright als „Musik ©"-Zeile (Issue #123)', () => {
    it('Lied 91: allein die Melodie hat ein Copyright -> eigene Zeile', () => {
        const lied = {
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
                        vorname: 'Christian',
                        nachname: 'Lahusen',
                        geburtsjahr: 1886,
                        sterbejahr: 1975,
                    },
                ],
                copyright: 'Bärenreiter-Verlag, Kassel',
            },
            melodieAutorExtraSuffix: '„Noch hinter Berges Rande“',
        };
        expect(buildFooter(lied)).toBe(
            'Text: Eberhard Köhler (1927–2014)\n' +
                'Melodie: Christian Lahusen (1886–1975) „Noch hinter Berges Rande“\n' +
                'Musik © Bärenreiter-Verlag, Kassel',
        );
        expect(melodyCopyrightPlacement(lied)).toBe('music-line');
    });

    it('Lied 414: Text und Melodie mit Copyright -> Melodie-Copyright bleibt inline', () => {
        const lied = {
            text: {
                authors: [{ vorname: 'Lothar', nachname: 'Zenetti' }],
                copyright: 'Strube Verlag, München',
            },
            melodie: {
                authors: [{ vorname: 'Peter', nachname: 'Klever' }],
                copyright: 'Rechtsnachfolge Peter Klever',
            },
        };
        expect(buildFooter(lied)).toBe(
            'Text: Lothar Zenetti © Strube Verlag, München\n' +
                'Melodie: Peter Klever © Rechtsnachfolge Peter Klever',
        );
        expect(melodyCopyrightPlacement(lied)).toBe('inline');
    });

    it('Copyright-Marker am Text zählt als Text-Copyright', () => {
        expect(
            buildFooter({
                text: { authors: [{ nachname: 'A' }], copyright: '©' },
                melodie: { authors: [{ nachname: 'B' }], copyright: 'Verlag M' },
            }),
        ).toBe('Text: © A\nMelodie: B © Verlag M');
    });

    it('Lied 368: Melodie-Copyright = Lied-Copyright -> nur das des Liedes', () => {
        const lied = {
            copyright: 'Bärenreiter-Verlag, Kassel',
            text: { authors: [{ vorname: 'Arno', nachname: 'Pötzsch' }] },
            melodie: {
                authors: [{ vorname: 'Christian', nachname: 'Lahusen' }],
                copyright: ' bärenreiter-verlag,  Kassel ',
            },
        };
        expect(buildFooter(lied)).toBe(
            'Text: Arno Pötzsch\nMelodie: Christian Lahusen\n© Bärenreiter-Verlag, Kassel',
        );
        expect(melodyCopyrightPlacement(lied)).toBe('lied');
    });

    it('Text-Copyright = Lied-Copyright -> nur das des Liedes, Melodie bekommt die Musik-Zeile', () => {
        expect(
            buildFooter({
                copyright: 'Verlag L',
                text: { authors: [{ nachname: 'A' }], copyright: 'Verlag L' },
                melodie: { authors: [{ nachname: 'B' }], copyright: 'Verlag M' },
            }),
        ).toBe('Text: A\nMelodie: B\nMusik © Verlag M\n© Verlag L');
    });

    it('Melodie- und anderes Lied-Copyright, Text ohne -> Musik-Zeile plus Lied-Copyright', () => {
        expect(
            buildFooter({
                copyright: 'Verlag L',
                text: { authors: [{ nachname: 'A' }] },
                melodie: { authors: [{ nachname: 'B' }], copyright: 'Verlag M' },
            }),
        ).toBe('Text: A\nMelodie: B\nMusik © Verlag M\n© Verlag L');
    });

    it('Melodie-Copyright ohne Melodie-Autor: nur die Musik-Zeile', () => {
        expect(
            buildFooter({
                text: { authors: [{ nachname: 'A' }] },
                melodie: { copyright: 'Verlag X' },
            }),
        ).toBe('Text: A\nMusik © Verlag X');
    });

    it('"Text und Melodie:" – Musik-Zeile nur, wenn allein die Melodie ein Copyright hat', () => {
        const author = { vorname: 'Paul', nachname: 'Gerhardt' };
        expect(
            buildFooter({
                text: { authors: [author], copyright: 'Verlag T' },
                melodie: { authors: [author], copyright: 'Verlag M' },
            }),
        ).toBe('Text und Melodie: Paul Gerhardt © Verlag T © Verlag M');
        expect(
            buildFooter({
                text: { authors: [author], copyright: 'Verlag X' },
                melodie: { authors: [author], copyright: 'Verlag X' },
            }),
        ).toBe('Text und Melodie: Paul Gerhardt © Verlag X');
        expect(
            buildFooter({
                text: { authors: [author] },
                melodie: { authors: [author], copyright: 'Verlag M' },
            }),
        ).toBe('Text und Melodie: Paul Gerhardt\nMusik © Verlag M');
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
        // Mit Text-Copyright, damit das Melodie-Copyright inline bleibt (Issue #123).
        const lied = {
            copyright: 'Verlag Merseburger',
            text: { authors: [koehler, lehmann], copyright: 'Textverlag' },
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
        // Mit Text-Copyright, damit das Melodie-Copyright inline bleibt (Issue #123).
        const [, line] = buildFooterLines({
            text: { authors: [koehler], copyright: 'Textverlag' },
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

    it('die Musik-Zeile ist eine eigene Copyright-Zeile ohne Autor (Issue #123)', () => {
        const lied = {
            copyright: 'Verlag L',
            text: { authors: [koehler] },
            melodie: { authors: [lehmann], copyright: 'Melodieverlag' },
        };
        const lines = buildFooterLines(lied);
        expect(lines.map((l) => l.kind)).toEqual([
            'text',
            'melodie',
            'musikCopyright',
            'copyright',
        ]);
        expect(lines.map((l) => l.segments.map((s) => s.text).join(''))).toEqual(
            buildFooter(lied).split('\n'),
        );
        expect(lines[2].segments).toEqual([{ text: 'Musik © Melodieverlag' }]);
    });

    it('das „©" eines Markers steht vor dem Autor, aber nicht unter dem Link (Issue #114)', () => {
        const [line] = buildFooterLines({ melodie: { authors: [lehmann], copyright: '(c)' } });
        expect(line.segments.map((s) => s.text)).toEqual([
            'Melodie: ',
            '© ',
            'Siegfried Lehmann (1932)',
        ]);
        expect(line.segments.filter((s) => s.author).map((s) => s.text)).toEqual([
            'Siegfried Lehmann (1932)',
        ]);
    });

    it('ein mitgebrachter „;"-Trenner steht nicht unter dem Link (Issue #110)', () => {
        const hiller = { autorPrefix: '; bei', vorname: 'Johann Adam', nachname: 'Hiller' };
        const [line] = buildFooterLines({ melodie: { authors: [lehmann, hiller] } });
        expect(line.segments.map((s) => s.text)).toEqual([
            'Melodie: ',
            'Siegfried Lehmann (1932)',
            '; ',
            'bei Johann Adam Hiller',
        ]);
        expect(line.segments[3].author).toBe(hiller);
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
