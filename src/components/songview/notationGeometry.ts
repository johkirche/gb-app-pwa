/**
 * The printed hymnal's page, in the units OSMD lays a sheet out in.
 *
 * The Notenbild is the book's engraving verbatim, and its geometry is the same
 * for all 564 songs: a 249.44pt block holding a 240.96pt system, drawn with a
 * 3.81pt staff space, 8.36pt above the first staff line and ~20.5pt below the
 * last. OSMD measures in units of one staff space and draws it as 10px at
 * zoom 1, which gives the conversion below and lets every print measurement be
 * stated as itself.
 */

export const PRINT_BLOCK_WIDTH_PT = 249.44;
export const PRINT_SYSTEM_WIDTH_PT = 240.96;
export const PRINT_STAFF_SPACE_PT = 3.81;
export const PRINT_SPACE_ABOVE_PT = 8.36;
export const PRINT_SPACE_BELOW_PT = 20.5;

/** One print point in OSMD pixels (OSMD draws a staff space as 10px at zoom 1) */
export const PX_PER_PT = 10 / PRINT_STAFF_SPACE_PT;

/** Width the host is given while OSMD lays the sheet out on the printed page */
export const PRINT_HOST_PX = PRINT_BLOCK_WIDTH_PT * PX_PER_PT;

/** Page margins in OSMD units, i.e. what is left of the block beside the system */
export const PRINT_SIDE_MARGIN =
    (PRINT_BLOCK_WIDTH_PT - PRINT_SYSTEM_WIDTH_PT) / 2 / PRINT_STAFF_SPACE_PT;

/**
 * The zoom that draws the notes at the size the reader asked for.
 *
 * Notengröße is a width: the melody is DRAWN at the column times the scale, and
 * that width is the printed block — so on screen one print point is
 * `drawnWidth / PRINT_BLOCK_WIDTH_PT` pixels, whichever engraving is showing.
 * That is what keeps one control meaning one thing in both views.
 *
 * Below the fit width the sheet is laid out on the printed page and simply
 * scaled to that width, so nothing has to be computed. Past it the sheet is
 * laid out on the reader's width instead, and the size has to be carried across
 * in OSMD's own terms: a staff space wants to be
 * `PRINT_STAFF_SPACE_PT * drawnWidth / PRINT_BLOCK_WIDTH_PT` pixels, and OSMD
 * draws one as `10 * zoom`. Solve for zoom and every print measurement cancels,
 * leaving the printed block measured in OSMD pixels — which is `PRINT_HOST_PX`,
 * the width the sheet is given when it IS on the printed page. So the zoom is
 * just how much bigger than that page the reader is drawing it.
 *
 * Checked against a real render: at a 360px column the notehead comes out at
 * 8.21 / 9.86 / 11.50 / 13.14 px for scales 1.25 / 1.5 / 1.75 / 2 — linear, and
 * within 0.4% of what the Notenbild draws the same notehead at.
 */
export function reflowZoomFor(drawnWidth: number): number {
    return drawnWidth / PRINT_HOST_PX;
}
