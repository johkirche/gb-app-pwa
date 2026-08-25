/**
 * Prepares a Notenbild file (`gesangbuchlied.notentext_svg`) for inline display.
 *
 * Why inline instead of <img>: an image document is opaque to the page. The
 * baked Finale export draws in hard black, so through an <img> it would stay
 * black on black in the dark theme. Inlined, the same engraving inherits
 * `currentColor` and follows the selected appearance.
 *
 * Inlining also makes foreign markup part of this page, so the file is first
 * reduced to the drawing primitives a baked export actually contains — no
 * scripts, no external references, no event handlers.
 *
 * What must come through untouched is the map gb-scripts writes into the file:
 * `data-note`, `data-system`, `data-lyric` and `data-verse`, the `<rect>`s that
 * carry the system boxes, and the `class` on the group holding them. Nothing
 * here removes them today — attributes go by rule, not by allow-list — and
 * nothing here may start to: after the sanitizer, the playback would find an
 * engraving it can no longer follow. See utils/notationMap.
 */

// Drawing elements of a baked engraving. Everything else (script, foreignObject,
// image, a, animate*, style, …) is dropped.
const ALLOWED_ELEMENTS = new Set([
    'svg',
    'g',
    'defs',
    'symbol',
    'use',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'title',
    'desc',
    'clippath',
    'mask',
    'lineargradient',
    'radialgradient',
    'stop',
]);

// <use> points at the glyph paths in <defs>; only such in-document fragments
// stay allowed, never a URL that would reach off the page.
function isLocalReference(value: string): boolean {
    return value.trim().startsWith('#');
}

function scrub(el: Element): void {
    for (const child of Array.from(el.children)) {
        if (ALLOWED_ELEMENTS.has(child.nodeName.toLowerCase())) {
            scrub(child);
        } else {
            child.remove();
        }
    }

    for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value;

        const drop =
            name.startsWith('on') ||
            /javascript:/i.test(value) ||
            ((name === 'href' || name === 'xlink:href') && !isLocalReference(value)) ||
            (name === 'style' && /url\s*\(/i.test(value));

        if (drop) el.removeAttribute(attr.name);
    }
}

function normaliseRoot(root: Element): void {
    const width = parseFloat(root.getAttribute('width') ?? '');
    const height = parseFloat(root.getAttribute('height') ?? '');

    // Without a viewBox the aspect ratio would be lost the moment width/height go.
    if (!root.getAttribute('viewBox') && width > 0 && height > 0) {
        root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    // The intrinsic size is the print column (~250px) — far too small on screen.
    // Dropping it lets the container decide the width while the viewBox keeps
    // the proportions.
    root.removeAttribute('width');
    root.removeAttribute('height');

    // `fill` is inherited: note heads and the verse-1 lyrics baked into outlines
    // carry no fill of their own and would otherwise paint black. The stroked
    // staff lines, stems and barlines keep their own `fill="none"` and get their
    // colour from the `stroke` rule in the component stylesheet.
    root.setAttribute('style', 'display:block;width:100%;height:auto;fill:currentColor');
}

/**
 * Parse a Notenbild SVG and return markup safe to inline, or null when the file
 * is not a usable SVG.
 */
export function sanitizeNotationSvg(source: string): string | null {
    if (!source.trim()) return null;

    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = doc.documentElement;

    if (
        !root ||
        root.nodeName.toLowerCase() !== 'svg' ||
        doc.getElementsByTagName('parsererror').length > 0
    ) {
        return null;
    }

    scrub(root);
    normaliseRoot(root);

    return new XMLSerializer().serializeToString(root);
}
