// Was von einem Lied durchsucht wird — und womit die Trefferliste hinterher
// begründet, dass es dasteht.
//
// Die Faltung und das UND/ODER der Suchwörter liegen in `@/utils/search`; hier
// steht nur, welche Felder eines Liedes überhaupt hineingehen. Getrennt von
// `useSongFiltering`, weil alle drei Suchfelder der App (Liederliste,
// „Lieder hinzufügen", und über `matchesTerms` auch die Filterlisten) dieselbe
// Antwort brauchen, aber nur eines davon den Filterzustand der Liste hat.
import type { Song } from '@/db';
import { authorFilterName } from '@/utils/authorFormat';
import { countTerms, foldForSearch, longestRun, matchesTerms, snippetAround } from '@/utils/search';
import { verseText } from '@/utils/verses';

/**
 * Wie weit die Suche greift.
 *
 * 'titel' ist, womit die Liste aufmacht: Titel, beide Liednummern, Kategorien
 * und Autoren — kurze Felder, in denen ein getroffenes Wort etwas heißt.
 * 'text' nimmt die Strophen dazu. Das ist der Weg zu dem Lied, an das man sich
 * nur über eine Zeile erinnert — aber „Gott" steht in fast jeder Strophe des
 * Buches, und eine Suche, die darauf 400 Lieder zurückgibt, hat nichts
 * beantwortet. Deshalb eine Umschaltung und nicht beides auf einmal.
 */
export type SearchScope = 'titel' | 'text';

/** Eine Strophe, wie die Suche sie liest: eine Zeile, mit ihrer Nummer. */
export interface VerseLine {
    /** Die Strophennummer, wie sie auf der Liedseite neben der Strophe steht. */
    nummer: number;
    text: string;
}

/**
 * Die Felder eines Liedes, in denen die Suche nachsieht — Titel, Liednummer,
 * Kategorien und die beteiligten Autoren. Der Autor steht hier mit vollem Namen
 * (nicht Vor- und Nachname getrennt wie früher), damit „johann bach" als zwei
 * UND-verknüpfte Wörter aufgeht.
 */
export function songSearchFields(song: Song): string[] {
    return [
        song.titel,
        song.index ? String(song.index) : '',
        ...song.kategorien.map((cat) => cat.name),
        ...[...song.textAutoren, ...song.melodieAutoren].map(authorFilterName),
    ].filter(Boolean);
}

// Die Strophen eines Liedes, zu je einer Zeile geglättet. `verseText` nimmt den
// Trennstrich des Notensetzers heraus und macht aus den Zeilenumbrüchen der
// Erfassung wieder fortlaufenden Text; hier fällt auch der Absatz zwischen
// Strophe und Kehrvers noch weg, denn ein Ausschnitt ist eine Zeile.
//
// Die Nummer wird vor dem Aussortieren vergeben: eine leer erfasste Strophe
// fällt heraus, ohne die Zählung der folgenden zu verschieben.
const verseLines = new WeakMap<Song, VerseLine[]>();

export function songVerseLines(song: Song): VerseLine[] {
    let lines = verseLines.get(song);
    if (!lines) {
        lines = song.strophen
            .map((strophe, idx) => ({
                nummer: idx + 1,
                text: verseText(strophe).replace(/\s+/g, ' ').trim(),
            }))
            .filter((line) => line.text);
        verseLines.set(song, lines);
    }
    return lines;
}

// Die gefalteten Suchfelder hängen am Lied selbst: gefiltert wird bei jedem
// Tastendruck über den ganzen Bestand, und die Faltung ist daran der teuerste
// Teil. Ein Sync tauscht die Lied-Objekte aus und damit auch ihre Einträge —
// deshalb WeakMaps und kein nach Hand zu leerender Cache.
//
// Der Strophentext wird erst gefaltet, wenn zum ersten Mal jemand in ihm sucht:
// das ist der halbe Bestand an Text, und die meisten Sitzungen suchen nie darin.
const foldedFields = new WeakMap<Song, string[]>();
const foldedVerses = new WeakMap<Song, string[]>();
const foldedWithVerses = new WeakMap<Song, string[]>();

function songSearchHaystack(song: Song): string[] {
    let folded = foldedFields.get(song);
    if (!folded) {
        folded = songSearchFields(song).map((field) => foldForSearch(field));
        foldedFields.set(song, folded);
    }
    return folded;
}

// Die gefalteten Strophen, in der Reihenfolge von `songVerseLines` — beide
// zusammen sind, was der Ausschnitt braucht: worin gesucht wird, und was dann
// dasteht.
function songFoldedVerses(song: Song): string[] {
    let folded = foldedVerses.get(song);
    if (!folded) {
        folded = songVerseLines(song).map((line) => foldForSearch(line.text));
        foldedVerses.set(song, folded);
    }
    return folded;
}

function songVerseHaystack(song: Song): string[] {
    let folded = foldedWithVerses.get(song);
    if (!folded) {
        folded = [...songSearchHaystack(song), ...songFoldedVerses(song)];
        foldedWithVerses.set(song, folded);
    }
    return folded;
}

/** Trifft die Eingabe dieses Lied? `terms` kommt aus `searchTerms`. */
export function songMatchesTerms(
    song: Song,
    terms: string[],
    scope: SearchScope = 'titel',
): boolean {
    return matchesTerms(
        terms,
        scope === 'text' ? songVerseHaystack(song) : songSearchHaystack(song),
    );
}

/**
 * Wie nah dieses Lied an der Eingabe liegt: der längste Zug, den die Suchwörter
 * irgendwo an ihm ununterbrochen bedecken.
 *
 * Gemessen wird über alle durchsuchten Felder einzeln und das beste genommen —
 * ein Titel, der die Eingabe wörtlich trägt, schlägt damit von selbst eine
 * Strophe, in der dieselben Wörter weit auseinanderliegen. Die Zahl ordnet die
 * Trefferliste (siehe SongsListPage); sie steht nirgends auf dem Bildschirm.
 */
export function songSearchRank(song: Song, terms: string[], scope: SearchScope = 'titel'): number {
    const haystack = scope === 'text' ? songVerseHaystack(song) : songSearchHaystack(song);

    let best = 0;
    for (const folded of haystack) {
        const run = longestRun(folded, terms);
        if (run > best) best = run;
    }

    return best;
}

/**
 * Die erste Strophe, in der ein Suchwort steht, als Ausschnitt — die Zeile, die
 * unter dem Titel begründet, warum dieses Lied in der Trefferliste steht.
 *
 * Null, wenn kein Suchwort im Text vorkommt: dann hat der Titel (oder eine
 * Nummer, eine Kategorie, ein Autor) getroffen, und die Markierung sitzt schon
 * dort, wo sie hingehört.
 */
export function songVerseSnippet(song: Song, terms: string[]): VerseLine | null {
    if (!terms.length) return null;

    // Die Strophe, in der die meisten Suchwörter beieinanderstehen — nicht die
    // erste, in der irgendeines vorkommt. Die Wörter einer Eingabe dürfen sich
    // über das ganze Lied verteilen (so ist die Suche gebaut), aber wer sich an
    // eine Zeile erinnert, hat sie als Zeile im Ohr: „herz und gemüte" fände
    // sein „und" sonst schon in Strophe 1 und zeigte eine Zeile vor, die mit
    // der Frage nichts zu tun hat.
    const lines = songVerseLines(song);
    const folded = songFoldedVerses(song);

    let best: VerseLine | null = null;
    let bestScore = 0;

    for (let i = 0; i < lines.length; i++) {
        const score = countTerms(folded[i], terms);

        if (score > bestScore) {
            bestScore = score;
            best = lines[i];
            // Mehr als alle Suchwörter kann eine Strophe nicht tragen.
            if (bestScore === terms.length) break;
        }
    }

    if (!best) return null;

    const text = snippetAround(best.text, terms);
    return text ? { nummer: best.nummer, text } : null;
}
