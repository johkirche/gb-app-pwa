// Einheitliche Formatierung von Autorenangaben.
//
// 1:1-Port der kanonischen Implementierung aus dem Dashboard
// (gb-dashboard/src/assets/js/authorFormat.js), damit App und Dashboard
// identisch formatieren (siehe dortige Issues #18, #23, #24).
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

// Liste von Autoren als ", "-getrennter String, optional gefolgt von
// Copyright-Zeilen (jeweils mit "© " und durch Zeilenumbruch getrennt).
export function formatAuthors(
    authors?: AuthorLike[] | null,
    ...copyrights: (string | null | undefined)[]
): string {
    const authorStrings = (authors || []).map(formatAuthorEntry).filter(Boolean);
    const copyrightStrings = copyrights
        .filter((c) => c && String(c).trim())
        .map((c) => `© ${String(c).trim()}`);
    return [authorStrings.join(', '), ...copyrightStrings].filter(Boolean).join('\n');
}

// --- Footer nach Janoschs Grammatik ----------------------------------------
// Gemeinsam genutzt vom Notentext-Export (CSV-Spalte „footer") und vom
// Kopier-Button in der Lied-Detailansicht (Issue #64), damit beide exakt
// identisch formatieren. Jahresangabe (Issue #18): (1798–1874) / (1989) – ohne
// Sternchen oder Kreuz, über formatYearRange.

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

// Pro Autor:  {praefix} {vorname} {nachname} (geburtsjahr–sterbejahr) {suffix} {ursprungsAutor}
//   - Leerzeichen nach vorname/praefix nur, wenn nicht leer
function formatFooterAuthorEntry(author?: AuthorLike | null): string {
    if (!author) return '';
    let s = '';
    if (author.autorPrefix) s += `${author.autorPrefix} `;
    if (author.vorname) s += `${author.vorname} `;
    if (author.nachname) s += author.nachname;
    s = s.trimEnd();

    const years = formatAuthorYears(author);
    if (years) s = s ? `${s} ${years}` : years;
    s = appendSuffix(s, author.autorSuffix);

    const ursprung = formatFooterUrsprungsAutor(author.ursprungsAutorObj);
    if (ursprung) s += s ? ` ${ursprung}` : ursprung;
    return s.trim();
}

function formatFooterAuthors(authors?: AuthorLike[] | null): string {
    return (authors || []).map(formatFooterAuthorEntry).filter(Boolean).join(', ');
}

function footerCopyright(copyright?: string | null): string {
    const v = copyright && String(copyright).trim();
    return v ? `© ${v}` : '';
}

// Liefert den fertig formatierten Footer:
//   Text: {Text-Autor} © {Text-Copyright}
//   Melodie: {Melodie-Autor} © {Melodie-Copyright}
//   © {Lied-Copyright}
// Sind Text- und Melodie-Autor gleich: "Text und Melodie: {Autor}".
// Leere Bestandteile (Copyright, Autor) werden samt führendem Trenner weggelassen.
//
// Lied-spezifische Zusatz-Suffixe (Issue #77): `textAutorExtraSuffix` und
// `melodieAutorExtraSuffix` sitzen direkt am Gesangbuchlied (nicht am Autor bzw.
// an der Melodie) und werden – nach denselben Interpunktions-Regeln wie ein
// normaler Suffix (Issue #76) – an den jeweiligen Autorenblock angehängt. So
// kann z. B. die Originalmelodie nur bei diesem Lied ergänzt werden, ohne beim
// Original-Lied desselben Melodie-Autors zu erscheinen.
export function buildFooter(lied?: FooterLied | null): string {
    const textAuthors = appendSuffix(
        formatFooterAuthors(lied?.text?.authors),
        lied?.textAutorExtraSuffix,
    );
    const melodyAuthors = appendSuffix(
        formatFooterAuthors(lied?.melodie?.authors),
        lied?.melodieAutorExtraSuffix,
    );
    const textCr = footerCopyright(lied?.text?.copyright);
    const melodyCr = footerCopyright(lied?.melodie?.copyright);
    const liedCr = footerCopyright(lied?.copyright);

    const lines: string[] = [];

    if (textAuthors && melodyAuthors && textAuthors === melodyAuthors) {
        const crs = [...new Set([textCr, melodyCr].filter(Boolean))];
        lines.push(['Text und Melodie:', textAuthors, ...crs].join(' '));
    } else {
        const textBody = [textAuthors, textCr].filter(Boolean).join(' ');
        if (textBody) lines.push(`Text: ${textBody}`);
        const melodyBody = [melodyAuthors, melodyCr].filter(Boolean).join(' ');
        if (melodyBody) lines.push(`Melodie: ${melodyBody}`);
    }

    if (liedCr) lines.push(liedCr);

    return lines.join('\n');
}
