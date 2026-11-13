// Einheitliche Formatierung von Autorenangaben.
//
// 1:1-Port der kanonischen Implementierung aus dem Dashboard
// (gb-dashboard/src/assets/js/authorFormat.js), damit App und Dashboard
// identisch formatieren (siehe dortige Issues #18, #23, #24, #110, #114, #123).
//
// Format der Jahresangabe (Issue #18 – keine Sternchen / Kreuze mehr):
//   Geburts- und Sterbejahr: (1798–1874)
//   nur Geburtsjahr:         (1989)
//   nur Sterbejahr:          (–1874)
//
// Unsichere Jahreszahlen bekommen ein Präfix (Issue #101). Da geburtsjahr und
// sterbejahr im Datenmodell Integer sind, liegen die Präfixe in zwei eigenen
// Textfeldern am Autor:  geburtsjahrePrefix (mit „e"!) und sterbejahrPrefix.
//   (um 1485–nach 1546)   (um 1500)   (–nach 1546)

export interface AuthorLike {
    vorname?: string | null;
    nachname?: string | null;
    geburtsjahr?: number | null;
    sterbejahr?: number | null;
    geburtsjahrePrefix?: string | null;
    sterbejahrPrefix?: string | null;
    autorPrefix?: string | null;
    autorSuffix?: string | null;
    ursprungsAutorObj?: AuthorLike | string | null;
}

export interface FooterLied {
    copyright?: string | null;
    textAutorExtraSuffix?: string | null;
    melodieAutorExtraSuffix?: string | null;
    text?: { authors?: AuthorLike[]; copyright?: string | null } | null;
    melodie?: { authors?: AuthorLike[]; copyright?: string | null } | null;
}

// Eine einzelne Jahreszahl mit optionalem Präfix: "um 1485" bzw. "1485".
function yearWithPrefix(prefix: string | null | undefined, year: number): string {
    const p = prefix == null ? '' : String(prefix).trim();
    return p ? `${p} ${year}` : String(year);
}

// Jahresangabe eines Autors. Leerer String, wenn weder Geburts- noch Sterbejahr
// vorhanden sind. Ein Präfix ohne zugehörige Jahreszahl wird ignoriert – es gibt
// dann nichts zu qualifizieren.
export function formatYearRange(
    geburtsjahr?: number | null,
    sterbejahr?: number | null,
    geburtsjahrePrefix?: string | null,
    sterbejahrPrefix?: string | null,
): string {
    if (!geburtsjahr && !sterbejahr) return '';
    const birth = geburtsjahr ? yearWithPrefix(geburtsjahrePrefix, geburtsjahr) : '';
    const death = sterbejahr ? `–${yearWithPrefix(sterbejahrPrefix, sterbejahr)}` : '';
    return `(${birth}${death})`;
}

// Bequemer Aufruf mit dem Autoren-Objekt – nimmt Jahre und Präfixe direkt vom
// Autor. Wird von den Vue-Templates und den Formatierern unten genutzt, damit
// die Feldnamen nur an dieser einen Stelle stehen.
export function formatAuthorYears(author?: AuthorLike | null): string {
    if (!author) return '';
    return formatYearRange(
        author.geburtsjahr,
        author.sterbejahr,
        author.geburtsjahrePrefix,
        author.sterbejahrPrefix,
    );
}

// Beginnt ein Eintrag (nach evtl. führenden Leerzeichen) mit „," oder „;", bringt
// er seinen Trenner selbst mit (Issues #76 und #110).
function startsWithSeparator(s: string): boolean {
    return /^\s*[,;]/.test(s);
}

// Setzt mehrere Autoren-Strings zu einer Aufzählung zusammen. Normalerweise
// mit ", " getrennt – beginnt der nächste Eintrag aber selbst mit einem
// Interpunktionszeichen (","/";"), bringt er seinen Trenner schon mit und der
// Standard-Trenner entfällt (Issue #110):
//   joinAuthorEntries(['J. S. Bach (1685–1750)', '; Nürnberg 1676'])
//     -> 'J. S. Bach (1685–1750); Nürnberg 1676'
// Dieselbe Regel wie in appendSuffix (Issue #76), nur für die Aufzählung
// mehrerer Autoren statt für einen angehängten Suffix.
export function joinAuthorEntries(
    entries?: (string | null | undefined)[] | null,
    separator = ', ',
): string {
    return (entries || [])
        .filter((e): e is string => Boolean(e))
        .reduce((acc, cur) => {
            if (!acc) return cur;
            return /^[,;]/.test(cur) ? acc + cur : acc + separator + cur;
        }, '');
}

// Hängt einen Suffix an einen bereits formatierten String an. Beginnt der Suffix
// (nach evtl. führenden Leerzeichen) mit einem Interpunktionszeichen (","/";"),
// wird KEIN trennendes Leerzeichen davorgesetzt (Issue #76):
//   appendSuffix('unbekannt', '; aus dem …')            -> 'unbekannt; aus dem …'
//   appendSuffix('Lehmann (1932–2025)', '„Bitte Gott…"') -> 'Lehmann (1932–2025) „Bitte Gott…"'
// Leerer Suffix lässt `base` unverändert; ist `base` leer, wird der Suffix
// (ohne führende Leerzeichen) allein zurückgegeben.
export function appendSuffix(base: string, suffix?: string | null): string {
    if (suffix == null) return base;
    const suf = String(suffix).trimStart();
    if (!suf) return base;
    if (!base) return suf;
    return /^[,;]/.test(suf) ? base + suf : `${base} ${suf}`;
}

// Ein einzelner Autor:
//   {Praefix} {Vorname} {Nachname} (Jahre) {Suffix} {Ursprungsautor} (Jahre)
// Leere Bestandteile (inkl. fehlender Vorname, Issue #23) werden samt
// zugehörigem Leerzeichen weggelassen. Der Ursprungsautor (Issue #24) wird ohne
// Praefix/Suffix angehängt; `ursprungsAutorObj` ist entweder ein Autoren-Objekt
// oder der String 'Keine'.
export function formatAuthorEntry(author?: AuthorLike | null): string {
    if (!author) return '';
    const parts: string[] = [];
    if (author.autorPrefix) parts.push(author.autorPrefix);
    const name = [author.vorname, author.nachname].filter(Boolean).join(' ');
    if (name) parts.push(name);
    const years = formatAuthorYears(author);
    if (years) parts.push(years);

    // Suffix nach denselben Interpunktions-Regeln wie im Footer (Issue #76).
    let s = appendSuffix(parts.join(' '), author.autorSuffix);

    const u = author.ursprungsAutorObj;
    if (u && typeof u === 'object') {
        const uName = [u.vorname, u.nachname].filter(Boolean).join(' ');
        const uYears = formatAuthorYears(u);
        const uStr = [uName, uYears].filter(Boolean).join(' ');
        if (uStr) s = s ? `${s} ${uStr}` : uStr;
    }
    return s;
}

// Copyright-Marker (Issue #114): Steht im Copyright-Feld nur „(c)" oder „©",
// liegen die Rechte beim Autor selbst. Statt „… © beim Urheber" wird das „©"
// dann leerzeichengetrennt VOR den Autorennamen gesetzt:
//   Melodie: © Martin Göth (1957)
export function isCopyrightMarker(copyright?: string | null): boolean {
    if (copyright == null) return false;
    const v = String(copyright).trim().toLowerCase();
    return v === '(c)' || v === '©';
}

// Vergleichsform einer Copyright-Angabe: Groß-/Kleinschreibung und Leerraum
// zählen nicht („Bärenreiter-Verlag,  Kassel" == „bärenreiter-verlag, Kassel").
function copyrightKey(copyright?: string | null): string {
    return String(copyright || '')
        .normalize('NFC')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// Liste von Autoren als ", "-getrennter String, optional gefolgt von
// Copyright-Zeilen (jeweils mit "© " und durch Zeilenumbruch getrennt).
//
// Ein Copyright-Marker (Issue #114) erzeugt keine eigene Zeile, sondern setzt
// das „©" vor die Autoren. Gleiche Copyrights (z. B. Melodie- = Lied-Copyright,
// Issue #123) erscheinen nur einmal.
export function formatAuthors(
    authors?: AuthorLike[] | null,
    ...copyrights: (string | null | undefined)[]
): string {
    let authorStrings = joinAuthorEntries((authors || []).map(formatAuthorEntry));
    if (copyrights.some(isCopyrightMarker) && authorStrings) authorStrings = `© ${authorStrings}`;
    const seen = new Set<string>();
    const copyrightStrings = copyrights
        .filter((c): c is string => Boolean(c && String(c).trim()) && !isCopyrightMarker(c))
        .filter((c) => !seen.has(copyrightKey(c)) && Boolean(seen.add(copyrightKey(c))))
        .map((c) => `© ${String(c).trim()}`);
    return [authorStrings, ...copyrightStrings].filter(Boolean).join('\n');
}

// Der Name, unter dem ein Autor in der Liederliste gefiltert wird: Vor- und
// Nachname, ohne Jahre, Präfix oder Suffix. App-weit dieselbe Bildungsregel,
// damit ein Klick auf einen Autor in der Lied-Ansicht denselben Wert trifft,
// den der Filter aus den Liedern zusammenträgt (useSongFiltering).
export function authorFilterName(author?: AuthorLike | null): string {
    if (!author) return '';
    return [author.vorname, author.nachname].filter(Boolean).join(' ').trim();
}

// --- Footer nach Janoschs Grammatik ----------------------------------------
// Gemeinsam genutzt vom Notentext-Export (CSV-Spalte „footer") und vom
// Kopier-Button in der Lied-Detailansicht (Issue #64), damit beide exakt
// identisch formatieren. Jahresangabe (Issue #18): (1798–1874) / (1989) – ohne
// Sternchen oder Kreuz, über formatYearRange.
//
// Der Footer wird als Segmentliste gebaut (buildFooterLines) und erst zuletzt
// zu Text zusammengefügt (buildFooter): so bleibt die Formatierung an einer
// Stelle, während die App die Autoren einzeln anfassen kann – in der
// Lied-Ansicht filtert ein Tippen auf einen Autor die Liederliste nach ihm.

// ursprungsAutor:  {vorname} {nachname} (geburtsjahr–sterbejahr)  (ohne Praefix/Suffix)
// ursprungsAutorObj ist entweder ein Autoren-Objekt oder der String 'Keine'.
function formatFooterUrsprungsAutor(u?: AuthorLike | string | null): string {
    if (!u || typeof u !== 'object') return '';
    let s = '';
    if (u.vorname) s += `${u.vorname} `;
    if (u.nachname) s += u.nachname;
    s = s.trimEnd();
    const years = formatAuthorYears(u);
    if (years) s = s ? `${s} ${years}` : years;
    return s.trim();
}

// Der Autor selbst:  {praefix} {vorname} {nachname} (geburtsjahr–sterbejahr) {suffix}
//   - Leerzeichen nach vorname/praefix nur, wenn nicht leer
// Ohne den Ursprungsautor, der ein anderer Mensch ist und deshalb ein eigenes
// Segment bekommt (siehe footerAuthorSegments).
function formatFooterAuthorSelf(author?: AuthorLike | null): string {
    if (!author) return '';
    let s = '';
    if (author.autorPrefix) s += `${author.autorPrefix} `;
    if (author.vorname) s += `${author.vorname} `;
    if (author.nachname) s += author.nachname;
    s = s.trimEnd();

    const years = formatAuthorYears(author);
    if (years) s = s ? `${s} ${years}` : years;
    return appendSuffix(s, author.autorSuffix).trim();
}

/** Ein Stück Footer-Text. `author` ist gesetzt, wenn es für genau diesen Autor steht. */
export interface FooterSegment {
    text: string;
    author?: AuthorLike;
}

/**
 * `musikCopyright` ist die eigene Zeile „Musik © …" (Issue #123), `copyright`
 * das Copyright des ganzen Liedes.
 */
export type FooterLineKind = 'text' | 'melodie' | 'textUndMelodie' | 'musikCopyright' | 'copyright';

export interface FooterLine {
    kind: FooterLineKind;
    /** Aneinandergehängt ergeben die Segmente exakt die Textzeile aus buildFooter. */
    segments: FooterSegment[];
}

function segmentsText(segments: FooterSegment[]): string {
    return segments.map((s) => s.text).join('');
}

// Autorenliste als Segmente, ", "-getrennt – nach joinAuthorEntries (Issue
// #110): ein Eintrag, der mit „,"/„;" beginnt (etwa das Präfix „; bei"), bringt
// seinen Trenner selbst mit. Der Trenner wird dann ein eigenes Segment, damit er
// nicht mit unter dem Link steht. Klickbar ist nur der Autor selbst: der
// Ursprungsautor steht nicht in textAutoren/melodieAutoren und wäre als Filter
// ohne Treffer.
function footerAuthorSegments(authors?: AuthorLike[] | null): FooterSegment[] {
    const segments: FooterSegment[] = [];
    for (const author of authors || []) {
        let self = formatFooterAuthorSelf(author);
        let ursprung = formatFooterUrsprungsAutor(author?.ursprungsAutorObj);
        if (!self && !ursprung) continue;
        if (segments.length) {
            const lead = self || ursprung;
            if (startsWithSeparator(lead)) {
                const sep = lead.match(/^\s*[,;]\s*/)![0];
                segments.push({ text: sep });
                if (self) self = self.slice(sep.length);
                else ursprung = ursprung.slice(sep.length);
            } else {
                segments.push({ text: ', ' });
            }
        }
        if (self) segments.push({ text: self, author });
        if (ursprung) segments.push({ text: self ? ` ${ursprung}` : ursprung });
    }
    return segments;
}

// Setzt das „©" vor einen Autorenblock (Issue #114). Leerer Block bleibt leer.
function prefixCopyrightSegments(segments: FooterSegment[]): FooterSegment[] {
    return segmentsText(segments) ? [{ text: '© ' }, ...segments] : segments;
}

// appendSuffix auf einer Segmentliste: der Suffix hängt sich nur hinten an,
// der Rest hinter dem bisherigen Text ist also genau das neue Segment.
function appendSuffixSegments(segments: FooterSegment[], suffix?: string | null): FooterSegment[] {
    const base = segmentsText(segments);
    const withSuffix = appendSuffix(base, suffix);
    if (withSuffix === base) return segments;
    return [...segments, { text: withSuffix.slice(base.length) }];
}

function footerCopyright(copyright?: string | null): string {
    if (isCopyrightMarker(copyright)) return '';
    const v = copyright && String(copyright).trim();
    return v ? `© ${v}` : '';
}

// Label der eigenen Zeile für das Melodie-Copyright (Issue #123).
export const MUSIC_COPYRIGHT_LABEL = 'Musik';

/** Wo das Melodie-Copyright im Footer steht – siehe footerCopyrights. */
export type MelodyCopyrightPlacement = 'music-line' | 'inline' | 'lied' | 'none';

// Welche Copyrights der Footer zeigt und wo das Melodie-Copyright steht
// (Issue #123, Entscheidung der Korrektoren):
//   1. Gleicht das Text- oder Melodie-Copyright dem Lied-Copyright, steht es nur
//      einmal – als Lied-Copyright am Ende. Das Melodie-Copyright muss in der DB
//      trotzdem an der Melodie stehen, damit es bei anderen Liedern mit derselben
//      Melodie (und anderem Text) erscheint (Lied 368).
//   2. Hat danach ALLEIN die Melodie ein Copyright, bekommt es eine eigene Zeile
//      „Musik © …" – ein nacktes „© …" unter der Melodie sähe aus wie ein
//      Copyright für das ganze Lied.
//   3. Trägt auch der Text ein „©" (Copyright oder Marker), bleibt das Melodie-
//      Copyright wie bisher inline hinter „Melodie: …".
//
// melodyPlacement 'lied' heißt: nur als Lied-Copyright; 'none': kein
// Melodie-Copyright bzw. nur der Marker.
function footerCopyrights(lied?: FooterLied | null): {
    textCr: string;
    melodyCr: string;
    liedCr: string;
    melodyPlacement: MelodyCopyrightPlacement;
} {
    const liedCr = footerCopyright(lied?.copyright);
    const own = (cr: string) =>
        cr && liedCr && copyrightKey(cr) === copyrightKey(liedCr) ? '' : cr;
    const rawMelodyCr = footerCopyright(lied?.melodie?.copyright);
    const textCr = own(footerCopyright(lied?.text?.copyright));
    const melodyCr = own(rawMelodyCr);
    const textMarker =
        isCopyrightMarker(lied?.copyright) || isCopyrightMarker(lied?.text?.copyright);

    let melodyPlacement: MelodyCopyrightPlacement = 'none';
    if (rawMelodyCr && !melodyCr) melodyPlacement = 'lied';
    else if (melodyCr) melodyPlacement = textCr || textMarker ? 'inline' : 'music-line';

    return { textCr, melodyCr, liedCr, melodyPlacement };
}

/** Wo steht das Melodie-Copyright im Footer? (Issue #123) */
export function melodyCopyrightPlacement(lied?: FooterLied | null): MelodyCopyrightPlacement {
    return footerCopyrights(lied).melodyPlacement;
}

// Der Footer, zeilenweise und in Segmenten:
//   Text: {Text-Autor} © {Text-Copyright}
//   Melodie: {Melodie-Autor} © {Melodie-Copyright}
//   © {Lied-Copyright}
// Sind Text- und Melodie-Autor gleich: "Text und Melodie: {Autor}".
// Leere Bestandteile (Copyright, Autor) werden samt führendem Trenner weggelassen.
//
// Hat allein die Melodie ein Copyright, steht es in einer eigenen Zeile
// (Issue #123, Regeln siehe footerCopyrights):
//   Text: Eberhard Köhler (1927–2014)
//   Melodie: Christian Lahusen (1886–1975) „Noch hinter Berges Rande"
//   Musik © Bärenreiter-Verlag, Kassel
//
// Copyright-Marker (Issue #114): Ist ein Copyright-Feld nur „(c)"/„©", wird das
// „©" vor den zugehörigen Autorenblock gesetzt statt dahinter. Ein Marker am
// Lied selbst gilt für Text- und Melodie-Autoren.
//   Text: Rolf Krenzer (1936–2007) © Rechtsnachfolge Rolf Krenzer
//   Melodie: © Martin Göth (1957)
//
// Lied-spezifische Zusatz-Suffixe (Issue #77): `textAutorExtraSuffix` und
// `melodieAutorExtraSuffix` sitzen direkt am Gesangbuchlied (nicht am Autor bzw.
// an der Melodie) und werden – nach denselben Interpunktions-Regeln wie ein
// normaler Suffix (Issue #76) – an den jeweiligen Autorenblock angehängt. So
// kann z. B. die Originalmelodie nur bei diesem Lied ergänzt werden, ohne beim
// Original-Lied desselben Melodie-Autors zu erscheinen.
export function buildFooterLines(lied?: FooterLied | null): FooterLine[] {
    const liedMarker = isCopyrightMarker(lied?.copyright);
    let textSegments = appendSuffixSegments(
        footerAuthorSegments(lied?.text?.authors),
        lied?.textAutorExtraSuffix,
    );
    if (liedMarker || isCopyrightMarker(lied?.text?.copyright)) {
        textSegments = prefixCopyrightSegments(textSegments);
    }
    let melodySegments = appendSuffixSegments(
        footerAuthorSegments(lied?.melodie?.authors),
        lied?.melodieAutorExtraSuffix,
    );
    if (liedMarker || isCopyrightMarker(lied?.melodie?.copyright)) {
        melodySegments = prefixCopyrightSegments(melodySegments);
    }
    const textAuthors = segmentsText(textSegments);
    const melodyAuthors = segmentsText(melodySegments);
    const { textCr, melodyCr, liedCr, melodyPlacement } = footerCopyrights(lied);
    const musicLine = melodyPlacement === 'music-line';
    const inlineMelodyCr = musicLine ? '' : melodyCr;

    const lines: FooterLine[] = [];

    if (textAuthors && melodyAuthors && textAuthors === melodyAuthors) {
        const crs = [...new Set([textCr, inlineMelodyCr].filter(Boolean))];
        lines.push({
            kind: 'textUndMelodie',
            segments: [
                { text: 'Text und Melodie: ' },
                ...textSegments,
                ...crs.map((cr) => ({ text: ` ${cr}` })),
            ],
        });
    } else {
        const pushLabelled = (
            kind: FooterLineKind,
            label: string,
            segments: FooterSegment[],
            copyright: string,
        ) => {
            const authors = segmentsText(segments);
            if (!authors && !copyright) return;
            const tail = copyright ? [{ text: authors ? ` ${copyright}` : copyright }] : [];
            lines.push({ kind, segments: [{ text: `${label}: ` }, ...segments, ...tail] });
        };
        pushLabelled('text', 'Text', textSegments, textCr);
        pushLabelled('melodie', 'Melodie', melodySegments, inlineMelodyCr);
    }

    if (musicLine) {
        lines.push({
            kind: 'musikCopyright',
            segments: [{ text: `${MUSIC_COPYRIGHT_LABEL} ${melodyCr}` }],
        });
    }
    if (liedCr) lines.push({ kind: 'copyright', segments: [{ text: liedCr }] });

    return lines;
}

/** Der fertig formatierte Footer als Text – die Zeilen aus buildFooterLines. */
export function buildFooter(lied?: FooterLied | null): string {
    return buildFooterLines(lied)
        .map((line) => segmentsText(line.segments))
        .join('\n');
}
