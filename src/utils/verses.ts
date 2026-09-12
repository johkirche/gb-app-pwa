/**
 * One stored verse, as loosely as the records actually come: the text sits in
 * `text` on a synced song, in `strophe` on some older ones, and inside a nested
 * object on the rest. Typed structurally rather than as `Strophe` so the verse
 * list and the Strophenwahl can both read it without one of them owning the
 * other's shape.
 */
export interface VerseLike {
    text?: string | { strophe?: string } | null;
    strophe?: string | null;
    anmerkung?: string | null;
}

function verseSource(verse: VerseLike): string | null | undefined {
    if (typeof verse.text === 'object' && verse.text !== null) {
        return verse.text.strophe;
    }
    return verse.text || verse.strophe;
}

/**
 * The verse as it is set on the page.
 *
 * The stored verses carry the line breaks of the editorial system — one line
 * per sung line, as the text was captured there. Those breaks are an artefact
 * of the capture, not of the setting: the printed book runs a verse on into its
 * column and breaks it wherever the measure ends, mid sung line as often as not
 * (Lied 6, verse 3: "zur schlichten Krippe / hin"). A single break is therefore
 * dropped here so the verse re-flows the way the book flows it, and the column
 * (.verse-col) is the book's own measure, so it flows to the same shape.
 *
 * A blank line survives as a break. That one was set deliberately — a Kehrvers
 * standing apart from the verse it follows — and it is what `pre-line` on
 * .verse-text is still there for. Rendering as text rather than markup means
 * the CMS field is never interpreted as HTML.
 */
export function verseText(verse: VerseLike): string {
    const text = verseSource(verse);
    if (typeof text !== 'string') return '';
    return (
        text
            // ¬ marks a syllable break for the engraver, never for the reader
            .replace(/¬/g, '')
            .split(/\r?\n[^\S\r\n]*(?:\r?\n)+/)
            .map((block) => block.replace(/\s*\r?\n\s*/g, ' ').trim())
            .filter(Boolean)
            .join('\n')
    );
}
