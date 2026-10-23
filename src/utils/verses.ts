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
 * standing apart from the verse it follows. Flattened to one string here, for
 * search and the Strophenwahl; the verse list sets the paragraphs themselves
 * from verseBlocks. Rendering as text rather than markup means the CMS field
 * is never interpreted as HTML.
 */
export function verseText(verse: VerseLike): string {
    return verseBlocks(verse)
        .map(({ label, text }) => [label, text].filter(Boolean).join('\n'))
        .join('\n');
}

/** One paragraph of a verse, with the label it is set under, if any */
export interface VerseBlock {
    /** „Refrain", as the book sets it in italics above the refrain */
    label?: string;
    text: string;
}

/**
 * A line that is nothing but „Refrain" — with or without a colon — names the
 * paragraph that follows it. The capture writes it that way throughout (44
 * songs, Lied 40 among them), so it is unambiguous to parse. Text standing on
 * the same line after the colon is the refrain's own first words, as in the
 * „Refrain: Kleiner Stern ..." cue.
 */
const LABEL_LINE = /^[^\S\r\n]*(Refrain|Kehrvers)[^\S\r\n]*(?::(.*))?$/i;

/**
 * The verse as it is set on the page, paragraph by paragraph.
 *
 * Paragraphs are what verseText documents: a blank line keeps one apart, a
 * single break re-flows. A label line opens a paragraph of its own as well,
 * blank line before it or not, so the refrain never runs on from the verse.
 */
export function verseBlocks(verse: VerseLike): VerseBlock[] {
    const text = verseSource(verse);
    if (typeof text !== 'string') return [];
    const blocks: VerseBlock[] = [];
    // ¬ marks a syllable break for the engraver, never for the reader
    for (const raw of text.replace(/¬/g, '').split(/\r?\n[^\S\r\n]*(?:\r?\n)+/)) {
        let current: VerseBlock | null = null;
        for (const line of raw.split(/\r?\n/)) {
            const label = LABEL_LINE.exec(line);
            if (label) {
                current = { label: label[1], text: label[2] ?? '' };
                blocks.push(current);
            } else if (current) {
                current.text += ' ' + line;
            } else {
                current = { text: line };
                blocks.push(current);
            }
        }
    }
    return blocks
        .map((block) => ({ ...block, text: block.text.replace(/\s+/g, ' ').trim() }))
        .filter((block) => block.label || block.text);
}
