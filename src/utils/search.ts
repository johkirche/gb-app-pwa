// Die Suche über den Bestand — eine Eingabe, mehrere Wörter.
//
// Zwei Regeln, an die sich alles hier hält:
//
//  - Die Wörter einer Eingabe werden UND-verknüpft, die durchsuchten Felder
//    ODER: „luther 45" findet Lied 45, wenn Luther daran beteiligt ist. Jedes
//    Wort muss irgendwo sitzen, keines muss im selben Feld sitzen wie das davor.
//  - Verglichen wird nicht auf dem Text selbst, sondern auf einer gefalteten
//    Fassung: klein geschrieben, ohne Umlautpunkte, ohne ß, ohne Satzzeichen.
//    So findet „grosser gott" auch „Großer Gott" und „leuchtt" auch „leucht't".
//
// Gefaltet wird Zeichen für Zeichen, und `foldWithSources` merkt sich dabei, aus
// welcher Stelle des Originals jede Stelle der Faltung stammt. Nur deshalb kann
// die Liste den Treffer hinterher im ungefalteten Titel markieren: „grosser" ist
// ein Zeichen länger als „Großer", ohne Rückrechnung läge die Markierung daneben.

/** Der gefaltete Text samt Rückweg zu den Stellen, aus denen er stammt. */
export interface FoldedText {
    /** Der gefaltete Text. */
    value: string;
    /** Zu jeder Stelle in `value`: der Anfang des Originalzeichens dahinter. */
    starts: number[];
    /** Zu jeder Stelle in `value`: das Ende ebendieses Originalzeichens. */
    ends: number[];
}

/** Ein Stück Text, und ob es für ein Suchwort steht. */
export interface TextPart {
    text: string;
    match: boolean;
}

// Zeichen, die für die Suche nicht zählen. Satzzeichen und die typografischen
// Apostrophe und Striche stehen in den Titeln in einer Form, die niemand
// mittippt — sie fallen auf beiden Seiten weg, im Text wie in der Eingabe.
const IGNORED_CHAR = /[.,;:!?"'’‘`´„“”»«()[\]{}\-–—_/\\]/;

// Die Zeichen, die NFD von seinem Grundbuchstaben abtrennt: ä → a + ¨.
const COMBINING_MARKS = /[\u0300-\u036f]/g;

// Die Faltung eines Zeichens ist teuer (normalize legt für jeden Aufruf eine
// neue Zeichenkette an), aber der Bestand kommt mit ein paar Dutzend
// verschiedenen Zeichen aus — gerechnet wird deshalb einmal pro Zeichen, nicht
// einmal pro Vorkommen.
const foldedChars = new Map<string, string>();

function foldChar(char: string): string {
    const known = foldedChars.get(char);
    if (known !== undefined) return known;

    const lower = char.toLowerCase();
    let folded: string;
    if (lower === 'ß') {
        folded = 'ss';
    } else if (IGNORED_CHAR.test(lower)) {
        folded = '';
    } else {
        folded = lower.normalize('NFD').replace(COMBINING_MARKS, '');
    }

    foldedChars.set(char, folded);
    return folded;
}

/** Die Vergleichsfassung eines Textes. */
export function foldForSearch(text: string): string {
    let value = '';
    for (const char of text) value += foldChar(char);
    return value;
}

/** Wie `foldForSearch`, aber mit dem Rückweg ins Original. */
export function foldWithSources(text: string): FoldedText {
    let value = '';
    const starts: number[] = [];
    const ends: number[] = [];
    let at = 0;

    for (const char of text) {
        const folded = foldChar(char);
        for (let i = 0; i < folded.length; i++) {
            starts.push(at);
            ends.push(at + char.length);
        }
        value += folded;
        at += char.length;
    }

    return { value, starts, ends };
}

/**
 * Die Suchwörter einer Eingabe: an Leerzeichen getrennt, gefaltet, ohne
 * Dubletten. Was nach der Faltung nichts übrig lässt (ein einzelner
 * Bindestrich), ist kein Suchwort — sonst fände eine Eingabe aus lauter
 * Satzzeichen nichts mehr.
 */
export function searchTerms(query: string): string[] {
    const terms = query
        .split(/\s+/)
        .map((word) => foldForSearch(word))
        .filter(Boolean);
    return [...new Set(terms)];
}

/**
 * Trägt eines der Felder jedes Suchwort? Die Felder kommen bereits gefaltet
 * herein — beim Filtern über den ganzen Bestand ist die Faltung der teuerste
 * Teil, und der Aufrufer kann sie sich merken.
 */
export function matchesTerms(terms: string[], foldedFields: string[]): boolean {
    return terms.every((term) => foldedFields.some((field) => field.includes(term)));
}

/**
 * Zerlegt einen Text in die Stücke, die ein Suchwort treffen, und die
 * dazwischen. Ohne Suchwörter (oder ohne Treffer) bleibt der Text ein Stück.
 */
export function highlightParts(text: string, terms: string[]): TextPart[] {
    if (!text) return [];
    if (!terms.length) return [{ text, match: false }];

    const folded = foldWithSources(text);
    const hits: Array<[number, number]> = [];

    for (const term of terms) {
        // Weiter ab `at + 1`, nicht ab dem Ende des Treffers: „aa" kommt in
        // „aaa" zweimal vor, und beide Stellen wollen markiert sein.
        let at = folded.value.indexOf(term);
        while (at !== -1) {
            hits.push([folded.starts[at], folded.ends[at + term.length - 1]]);
            at = folded.value.indexOf(term, at + 1);
        }
    }

    if (!hits.length) return [{ text, match: false }];

    // Überlappende Treffer werden ein Stück: „gott" und „gottes" sollen in
    // „Gottes" nicht zwei ineinander verschachtelte Markierungen ergeben.
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged: Array<[number, number]> = [];
    for (const [start, end] of hits) {
        const last = merged[merged.length - 1];
        if (last && start <= last[1]) {
            last[1] = Math.max(last[1], end);
        } else {
            merged.push([start, end]);
        }
    }

    const parts: TextPart[] = [];
    let cursor = 0;
    for (const [start, end] of merged) {
        if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
        parts.push({ text: text.slice(start, end), match: true });
        cursor = end;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });

    return parts;
}
