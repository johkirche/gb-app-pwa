import { describe, expect, it } from 'vitest';

import { notationMapKind } from './notationMap';
import { sanitizeNotationSvg } from './notationSvg';

// Shape of a baked Finale export (gesangbuchlied.notentext_svg): glyph outlines
// in <defs>, placed with <use>; staff lines and stems as stroked paths; the
// verse-1 lyrics baked into fill-less outlines.
const BAKED_EXPORT = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="249.44" height="130.24" viewBox="0 0 249.44 130.24">
<defs>
<path id="p0_font_1_63" d="M.48 1.01L.52 .97Z"/>
</defs>
<path fill="none" stroke="#000000" stroke-width=".64" d="M56.64 64.8H377.92"/>
<use xlink:href="#p0_font_1_63" transform="matrix(15,0,0,-15,46.8,60)"/>
<path transform="matrix(.75,0,0,.75,83.16,81)" d="M4.43-9.38L3.06-6.21Z"/>
</svg>`;

describe('sanitizeNotationSvg', () => {
    it('hands the container the sizing and makes the ink themeable', () => {
        const out = sanitizeNotationSvg(BAKED_EXPORT)!;

        expect(out).toContain('viewBox="0 0 249.44 130.24"');
        expect(out).not.toMatch(/\swidth="249.44"/);
        expect(out).not.toMatch(/\sheight="130.24"/);
        expect(out).toContain('fill:currentColor');
    });

    it('keeps the drawing primitives the export needs', () => {
        const out = sanitizeNotationSvg(BAKED_EXPORT)!;

        // The glyph definition and the <use> that places it must both survive,
        // or the notation renders empty.
        expect(out).toContain('id="p0_font_1_63"');
        expect(out).toContain('#p0_font_1_63');
        // `fill="none"` on the staff lines must survive: filling those stroked
        // paths would smear the engraving.
        expect(out).toContain('fill="none"');
        expect(out).toContain('stroke="#000000"');
    });

    it('derives a viewBox when only width/height are given', () => {
        const out = sanitizeNotationSvg(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><path d="M0 0H10"/></svg>',
        )!;

        expect(out).toContain('viewBox="0 0 200 100"');
    });

    it('drops scripts, handlers and off-document references', () => {
        const out = sanitizeNotationSvg(
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="steal()">
                <script>steal()</script>
                <foreignObject><div>x</div></foreignObject>
                <image href="https://example.test/pixel.png"/>
                <a href="javascript:steal()"><path d="M0 0H1" onclick="steal()"/></a>
                <use xlink:href="https://example.test/evil.svg#x"/>
            </svg>`,
        )!;

        expect(out).not.toContain('steal()');
        expect(out).not.toContain('onload');
        expect(out).not.toContain('onclick');
        expect(out).not.toContain('script');
        expect(out).not.toContain('foreignObject');
        expect(out).not.toContain('example.test');
    });

    // The map gb-scripts writes into the file is what lets the playback follow a
    // song across the engraving. It is not on any allow-list here — attributes
    // are dropped by rule, not by name — so this is what would notice if one of
    // those rules ever grew to cover it.
    it('lets the map through, which is what the playback follows', () => {
        const mapped = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 249.44 130.24">
            <use xlink:href="#p0_font_1_147" data-note="0" data-system="0"/>
            <path d="M1 1" data-lyric="0" data-verse="2"/>
            <g class="gb-systeme" fill="none" stroke="none" pointer-events="none">
                <rect data-system="0" x="4.24" y="8.36" width="240.96" height="15.24"/>
            </g>
        </svg>`;

        const out = sanitizeNotationSvg(mapped)!;
        const root = new DOMParser().parseFromString(out, 'image/svg+xml').documentElement;

        expect(notationMapKind(root)).toBe('notes-and-lyrics');
        expect(root.querySelector('rect[data-system="0"]')).not.toBeNull();
        expect(root.querySelector('g.gb-systeme')).not.toBeNull();
    });

    it('returns null for input that is not a usable SVG', () => {
        expect(sanitizeNotationSvg('')).toBeNull();
        expect(sanitizeNotationSvg('   ')).toBeNull();
        expect(sanitizeNotationSvg('<html><body>nope</body></html>')).toBeNull();
        expect(sanitizeNotationSvg('<svg><path d="M0 0H1"')).toBeNull();
    });
});
