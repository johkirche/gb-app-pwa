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

// Ab wann ein Suchwort auch mitten in einem Wort zählt.
//
// Mitten im Wort zu suchen ist im Deutschen unverzichtbar: „herzen" muss die
// „Kinderherzen" finden, „gnade" die „Gnadenzeit". Für kurze Wörter ist es
// dagegen nur Rauschen — „er" steckt in „Vertrauen", „und" in „Sünden", und
// wer eine Zeile eintippt, hat diese Treffer nie gemeint. Kurze Wörter zählen
// deshalb nur am Wortanfang, wo sie entweder das Wort selbst sind („er") oder
// sein Anfang („sol" in „sollt").
//
// Vier Zeichen, weil darunter im Deutschen fast nur Funktionswörter liegen und
// darüber fast nur Bedeutungsträger.
const MIN_INFIX_LENGTH = 4;

function isWordStart(folded: string, at: number): boolean {
    return at === 0 || folded[at - 1] === ' ';
}

/**
 * Die Stellen, an denen ein Suchwort in einem gefalteten Text zählt — die
 * gemeinsame Antwort für das Filtern, das Markieren und den Ausschnitt. Alle
 * drei müssen dieselbe sein: eine Markierung an einer Stelle, die beim Filtern
 * nicht gezählt hat, behauptet einen Treffer, den es nicht gab.
 */
export function termMatches(folded: string, term: string): number[] {
    if (!term) return [];

    const anywhere = term.length >= MIN_INFIX_LENGTH;
    const hits: number[] = [];

    // Weiter ab `at + 1`, nicht ab dem Ende des Treffers: „aa" kommt in „aaa"
    // zweimal vor, und beide Stellen wollen gefunden sein.
    let at = folded.indexOf(term);
    while (at !== -1) {
        if (anywhere || isWordStart(folded, at)) hits.push(at);
        at = folded.indexOf(term, at + 1);
    }

    return hits;
}

/** Steht dieses Suchwort in diesem gefalteten Text? */
function hasTerm(folded: string, term: string): boolean {
    if (term.length >= MIN_INFIX_LENGTH) return folded.includes(term);

    let at = folded.indexOf(term);
    while (at !== -1) {
        if (isWordStart(folded, at)) return true;
        at = folded.indexOf(term, at + 1);
    }

    return false;
}

/**
 * Trägt eines der Felder jedes Suchwort? Die Felder kommen bereits gefaltet
 * herein — beim Filtern über den ganzen Bestand ist die Faltung der teuerste
 * Teil, und der Aufrufer kann sie sich merken.
 */
export function matchesTerms(terms: string[], foldedFields: string[]): boolean {
    return terms.every((term) => foldedFields.some((field) => hasTerm(field, term)));
}

/**
 * Der längste Zug, den die Suchwörter in diesem gefalteten Text ununterbrochen
 * bedecken — in Zeichen gemessen.
 *
 * Das ist das Maß, an dem sich ablesen lässt, wie nah ein Fund an dem liegt, was
 * jemand eingetippt hat. „soll er drin im Herzen bleiben" bedeckt in der Strophe,
 * in der die Zeile wirklich steht, dreißig Zeichen am Stück; in einem Lied, das
 * bloß „im" und „Herzen" an zwei Enden hat, sechs. Zwei Treffer gehören zum
 * selben Zug, wenn sie sich überschneiden, aneinanderstoßen oder nur ein
 * Leerzeichen zwischen sich haben — also genau dann, wenn sie auf dem Bildschirm
 * als ein markiertes Stück erscheinen.
 */
export function longestRun(folded: string, terms: string[]): number {
    const spans: Array<[number, number]> = [];
    for (const term of terms) {
        for (const at of termMatches(folded, term)) spans.push([at, at + term.length]);
    }
    if (!spans.length) return 0;

    spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    let best = 0;
    let [start, end] = spans[0];

    for (let i = 1; i < spans.length; i++) {
        const [from, to] = spans[i];
        if (from <= end || folded.slice(end, from) === ' ') {
            end = Math.max(end, to);
        } else {
            best = Math.max(best, end - start);
            start = from;
            end = to;
        }
    }

    return Math.max(best, end - start);
}

/** Wie viele der Suchwörter in diesem gefalteten Text stehen. */
export function countTerms(folded: string, terms: string[]): number {
    let count = 0;
    for (const term of terms) if (hasTerm(folded, term)) count++;
    return count;
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
        for (const at of termMatches(folded.value, term)) {
            hits.push([folded.starts[at], folded.ends[at + term.length - 1]]);
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

/**
 * Der Ausschnitt eines Textes um die Stelle, an der die Suchwörter
 * zusammenstehen — die Zeile, mit der eine Trefferliste zeigt, *warum* ein Lied
 * darin steht, wenn der Treffer nicht im Titel sitzt, sondern in einer Strophe.
 *
 * Nicht das erste Vorkommen, sondern das dichteste: wer „soll er drin im Herzen
 * bleiben" eintippt, hat eine Zeile im Ohr, und „Im" steht schon im ersten Wort
 * der Strophe. Gezeigt wird deshalb das Fenster, in dem die meisten
 * verschiedenen Suchwörter beieinanderliegen — bei einer erinnerten Zeile ist
 * das die Zeile selbst.
 *
 * Gesucht wird auf der gefalteten Fassung und über `starts`/`ends` in den
 * Originaltext zurückgerechnet — aus demselben Grund wie in `highlightParts`:
 * „grosser" ist ein Zeichen länger als „Großer", eine auf der Faltung gemessene
 * Stelle läge im Original daneben. Geschnitten wird an Wortgrenzen, nie in den
 * Treffer hinein, und „…" sagt an, wo etwas fehlt.
 *
 * Erwartet einen Text ohne Zeilenumbrüche: der Ausschnitt ist eine Zeile.
 */
export function snippetAround(text: string, terms: string[], radius = 40): string | null {
    if (!text || !terms.length) return null;

    const folded = foldWithSources(text);

    // Jedes Vorkommen jedes Suchwortes, nach Stelle geordnet.
    const hits: Array<{ at: number; to: number; term: number }> = [];
    terms.forEach((term, index) => {
        for (const at of termMatches(folded.value, term)) {
            hits.push({ at, to: at + term.length - 1, term: index });
        }
    });
    if (!hits.length) return null;
    hits.sort((a, b) => a.at - b.at);

    // Das Fenster mit den meisten verschiedenen Suchwörtern, bei Gleichstand das
    // früheste. Zwei Zeiger über die Treffer: `counts` hält, was gerade im
    // Fenster steht, `counts.size` also, wie viele verschiedene Wörter es sind.
    const span = radius * 2;
    const counts = new Map<number, number>();
    let best = hits[0];
    let bestTo = hits[0].to;
    let bestScore = 0;
    let right = 0;

    for (let left = 0; left < hits.length; left++) {
        while (right < hits.length && hits[right].at - hits[left].at <= span) {
            counts.set(hits[right].term, (counts.get(hits[right].term) ?? 0) + 1);
            right++;
        }

        if (counts.size > bestScore) {
            bestScore = counts.size;
            best = hits[left];
            bestTo = hits[right - 1].to;
        }

        const remaining = (counts.get(hits[left].term) ?? 1) - 1;
        if (remaining > 0) counts.set(hits[left].term, remaining);
        else counts.delete(hits[left].term);
    }

    const hitFrom = folded.starts[best.at];
    const hitTo = folded.ends[bestTo];

    // Je breiter das Fenster selbst, desto weniger Rahmen darum — sonst wüchse
    // der Ausschnitt mit der Zahl der Suchwörter, und eine Zeile bliebe es nicht.
    const pad = Math.max(12, radius - Math.floor((hitTo - hitFrom) / 2));

    let from = Math.max(0, hitFrom - pad);
    let to = Math.min(text.length, hitTo + pad);

    // An die nächste Wortgrenze rücken, solange das den Treffer nicht anschneidet.
    if (from > 0) {
        const space = text.indexOf(' ', from);
        if (space !== -1 && space < hitFrom) from = space + 1;
    }
    if (to < text.length) {
        const space = text.lastIndexOf(' ', to);
        if (space > hitTo) to = space;
    }

    return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`;
}
