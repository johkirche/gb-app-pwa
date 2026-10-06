import type { Block } from '@/utils/bibel';

/**
 * A chapter laid out for reading: the stored blocks, with every run of text
 * told which verse it belongs to — so a verse that runs over several poetry
 * lines can be marked, copied or read aloud as a whole.
 */

export type LaidSegment =
    | { kind: 'verse'; verse: number }
    | { kind: 'text' | 'italic'; text: string; verse: number | null }
    | { kind: 'note'; text: string; key: string; verse: number | null };

export interface LaidLine {
    indent: number;
    segments: LaidSegment[];
}

export type LaidBlock =
    | { kind: 'heading'; level: number; text: string }
    | { kind: 'para'; poetry: boolean; lines: LaidLine[] };

export function layoutChapter(blocks: Block[]): LaidBlock[] {
    let verse: number | null = null;
    return blocks.map((block, b) => {
        if ('h' in block) return { kind: 'heading', level: block.h, text: block.t };
        return {
            kind: 'para',
            poetry: !!block.q,
            lines: block.p.map((line, l) => ({
                indent: line.i ?? 0,
                segments: line.s.map((seg, s): LaidSegment => {
                    if (typeof seg === 'string') return { kind: 'text', text: seg, verse };
                    if ('v' in seg) {
                        verse = seg.v;
                        return { kind: 'verse', verse: seg.v };
                    }
                    if ('e' in seg) return { kind: 'italic', text: seg.e, verse };
                    return { kind: 'note', text: seg.n, key: `${b}.${l}.${s}`, verse };
                }),
            })),
        };
    });
}

/** Every verse number in the chapter, in order. */
export function versesOf(laid: LaidBlock[]): number[] {
    return laid.flatMap((block) =>
        block.kind === 'para'
            ? block.lines.flatMap((line) =>
                  line.segments.flatMap((seg) => (seg.kind === 'verse' ? [seg.verse] : [])),
              )
            : [],
    );
}

/**
 * A verse as plain text, without its number or footnotes. Runs within a line
 * meet as written; lines meet with a space.
 */
export function verseText(laid: LaidBlock[], verse: number): string {
    return laid
        .flatMap((block) => (block.kind === 'para' ? block.lines : []))
        .map((line) =>
            line.segments
                .filter(
                    (seg) => (seg.kind === 'text' || seg.kind === 'italic') && seg.verse === verse,
                )
                .map((seg) => ('text' in seg ? seg.text : ''))
                .join(''),
        )
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** The opening words of a text, cut at a word and marked as cut. */
export function snippet(text: string, max = 140): string {
    return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')} …` : text;
}
