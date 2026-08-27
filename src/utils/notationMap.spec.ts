import { describe, expect, it } from 'vitest';

import {
    notationMapKind,
    noteHead,
    noteParts,
    syllables,
    systemOf,
    systemRect,
    verseForPass,
    versesAtNote,
} from './notationMap';

// A Notenbild in miniature, shaped like the ones gb-scripts writes: noteheads
// placed as <use>, syllables as their own <path>, and one invisible <rect> per
// system laid over the staff lines.
//
// LIED_8 is written in the older shape, where the ordinal sits on the head
// alone; NEW_BATCH is the shape the engraver writes now, where stem, flag, dot
// and head all repeat it.
function engraving(body: string): Element {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 249.44 130.24">${body}</svg>`;
    return new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
}

const LIED_8 = engraving(`
    <use xlink:href="#g1" data-note="0" data-system="0"/>
    <use xlink:href="#g2" data-note="1" data-system="0"/>
    <use xlink:href="#g3" data-note="2" data-system="1"/>
    <path d="M0 0" data-lyric="0" data-verse="1"/>
    <path d="M0 0" data-lyric="0" data-verse="2"/>
    <path d="M0 0" data-lyric="1" data-verse="2"/>
    <path d="M0 0" data-lyric="1" data-verse="3"/>
    <g class="gb-systeme" fill="none" stroke="none" pointer-events="none">
        <rect data-system="0" x="4.24" y="8.36" width="240.96" height="15.24"/>
        <rect data-system="1" x="4.24" y="66.8" width="240.96" height="15.24"/>
    </g>
`);

// The pieces of one note, in the order the engraver draws them: the stem lands
// before the head it hangs off, and the dot after both.
const NEW_BATCH = engraving(`
    <path d="M0 0" fill="none" stroke="#000000" data-note="0" data-system="0" data-part="stem"/>
    <use xlink:href="#head" data-note="0" data-system="0" data-part="head"/>
    <use xlink:href="#dot" data-note="0" data-system="0" data-part="dot"/>
    <use xlink:href="#head" data-note="1" data-system="0" data-part="head"/>
`);

describe('notationMapKind', () => {
    it('reads how far a song can be followed off the document', () => {
        expect(notationMapKind(LIED_8)).toBe('notes-and-lyrics');
        expect(notationMapKind(engraving('<use data-note="0" data-system="0"/>'))).toBe('notes');
        expect(notationMapKind(engraving('<path d="M0 0"/>'))).toBe('none');
    });

    it('takes a note map without a lyric map — the two are written apart', () => {
        expect(notationMapKind(engraving('<path d="M0 0" data-lyric="0" data-verse="1"/>'))).toBe(
            'none',
        );
    });
});

describe('reading a note off the map', () => {
    it('finds the notehead and the system it stands in', () => {
        const head = noteHead(LIED_8, 2);

        expect(head?.getAttribute('xlink:href')).toBe('#g3');
        expect(systemOf(head)).toBe('1');
        expect(systemRect(LIED_8, '1')?.getAttribute('y')).toBe('66.8');
    });

    // The regression the batch with grouped noteheads brought: every piece of a
    // note repeats its ordinal, and the stem is drawn first. Lit, that stem
    // paints nothing — it is stroked, with `fill="none"` — and the band would be
    // measured off a tall thin box beside the head.
    it('takes the head out of the pieces the note is drawn from, not the first of them', () => {
        const head = noteHead(NEW_BATCH, 0);

        expect(head?.getAttribute('data-part')).toBe('head');
        expect(systemOf(head)).toBe('0');
    });

    it('still finds the head where the ordinal sits on it alone', () => {
        expect(noteHead(LIED_8, 2)?.getAttribute('xlink:href')).toBe('#g3');
    });

    it('collects the pieces the note is drawn from, for the highlight to take', () => {
        expect(noteParts(NEW_BATCH, 0).map((part) => part.getAttribute('data-part'))).toEqual([
            'stem',
            'head',
            'dot',
        ]);
        // The engravings written before `data-part` have the one element.
        expect(noteParts(LIED_8, 2)).toHaveLength(1);
        expect(noteParts(LIED_8, 9)).toEqual([]);
    });

    it('answers nothing rather than throwing on an ordinal that is not one', () => {
        expect(noteHead(LIED_8, 1.5)).toBeNull();
        expect(noteHead(LIED_8, -1)).toBeNull();
        expect(versesAtNote(LIED_8, -1)).toEqual([]);
        expect(systemRect(LIED_8, 'a"]')).toBeNull();
        expect(syllables(LIED_8, 0, '1"]')).toEqual([]);
    });
});

describe('which verse is being sung', () => {
    it('takes the numbers written at the note, ascending', () => {
        expect(versesAtNote(LIED_8, 0)).toEqual(['1', '2']);
        // Written "2" then "3" here, and neither of them is "1": counting rows
        // from the top would name the wrong line.
        expect(versesAtNote(LIED_8, 1)).toEqual(['2', '3']);
        expect(versesAtNote(LIED_8, 2)).toEqual([]);
    });

    it('sings the next line down on the next pass through the same note', () => {
        expect(verseForPass(['1', '2'], 0)).toBe('1');
        expect(verseForPass(['1', '2'], 1)).toBe('2');
        // A note whose lines start at "2" is answered with "2", not with "1"
        expect(verseForPass(['2', '3'], 0)).toBe('2');
    });

    it('holds on the last line where a song repeats more often than it has lines', () => {
        expect(verseForPass(['1', '2'], 5)).toBe('2');
    });

    it('says nothing where the note carries no words — the melisma case', () => {
        expect(verseForPass([], 0)).toBeNull();
    });
});

describe('syllables', () => {
    it('collects every path a syllable fell to, not just the first', () => {
        const split = engraving(`
            <path d="M0 0" data-lyric="4" data-verse="1"/>
            <path d="M1 1" data-lyric="4" data-verse="1"/>
        `);

        expect(syllables(split, 4, '1')).toHaveLength(2);
    });

    it('takes only the line being sung', () => {
        expect(syllables(LIED_8, 0, '2')).toHaveLength(1);
        expect(syllables(LIED_8, 0, null)).toEqual([]);
    });
});
