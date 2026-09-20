import { type Ref, computed, onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * How wide the drawn notation gets, for both melody views.
 *
 * The notation is DRAWN at the column times the scale, and the box that shows
 * it grows with it — symmetrically, out of the notation column and into the
 * free width of the page — until it reaches the page's edge. Only past that
 * (phone widths, where there is no free width to grow into) does the box stay
 * put, and what happens then is the whole of `overflowsPage` below.
 *
 * The Notenbild and the MusicXML view share this so that one scale means the
 * same thing in both, which is what lets a single control drive the page.
 */

/** Breathing room kept between the widened notation and the page's edge */
const PAGE_GUTTER_PX = 16;

export function useNotationScale(containerRef: Ref<HTMLElement | null>, scale: Ref<number>) {
    /** Width of the column the view sits in — the notation at 100% */
    const columnWidth = ref<number | null>(null);
    /** Width the box may not exceed — the page's, not the column's */
    const availableWidth = ref<number | null>(null);
    let boundsElement: HTMLElement | null = null;
    let widthObserver: ResizeObserver | null = null;

    const drawnWidth = computed(() =>
        columnWidth.value === null ? null : columnWidth.value * (scale.value ?? 1),
    );

    /** What the reader can actually see at once: the drawing, or the page. */
    const boxWidth = computed(() =>
        drawnWidth.value === null
            ? null
            : Math.min(drawnWidth.value, availableWidth.value ?? drawnWidth.value),
    );

    const scrollBoxStyle = computed((): Record<string, string> => {
        if (boxWidth.value === null || columnWidth.value === null) return {};
        return {
            width: `${boxWidth.value}px`,
            // Negative once the box outgrows the column: that is what lets it
            // spread to both sides instead of running off to the right.
            marginInline: `${(columnWidth.value - boxWidth.value) / 2}px`,
        };
    });

    /** For a drawing that keeps the engraved setting: as wide as it was drawn,
     *  which past the fit width means wider than the box, and it scrolls. */
    const canvasStyle = computed(
        (): Record<string, string> =>
            drawnWidth.value === null ? {} : { width: `${drawnWidth.value}px` },
    );

    /** For a drawing that was re-broken onto the width it has: exactly the box,
     *  so there is nothing left to scroll to. */
    const fittedCanvasStyle = computed(
        (): Record<string, string> =>
            boxWidth.value === null ? {} : { width: `${boxWidth.value}px` },
    );

    /**
     * Whether the drawing has outgrown the page — the fit width, past which the
     * engraved setting can only be pushed sideways.
     *
     * This is the whole of the question the two renderers answer differently:
     * below it the engraving is the right size everywhere (on a phone it is
     * already 1.56× the printed book) and is what the reader should have, and
     * past it only re-breaking the systems can give them the size they asked
     * for AND the whole line at once.
     */
    const overflowsPage = computed(
        () =>
            drawnWidth.value !== null &&
            availableWidth.value !== null &&
            drawnWidth.value > availableWidth.value + 1,
    );

    // The box may grow out of its own column, but not out of the page: the
    // nearest ancestor that clips horizontally is what it has to stay inside.
    function findClippingAncestor(el: HTMLElement): HTMLElement {
        let node = el.parentElement;
        while (node && node !== document.body) {
            if (getComputedStyle(node).overflowX !== 'visible') return node;
            node = node.parentElement;
        }
        return document.documentElement;
    }

    function measureWidths() {
        if (containerRef.value) {
            columnWidth.value = containerRef.value.clientWidth;
        }
        if (boundsElement) {
            availableWidth.value = Math.max(0, boundsElement.clientWidth - 2 * PAGE_GUTTER_PX);
        }
    }

    onMounted(() => {
        if (!containerRef.value) return;
        boundsElement = findClippingAncestor(containerRef.value);
        measureWidths();
        widthObserver = new ResizeObserver(measureWidths);
        widthObserver.observe(containerRef.value);
        widthObserver.observe(boundsElement);
    });

    onBeforeUnmount(() => {
        if (widthObserver) {
            widthObserver.disconnect();
            widthObserver = null;
            boundsElement = null;
        }
    });

    return {
        columnWidth,
        drawnWidth,
        boxWidth,
        overflowsPage,
        scrollBoxStyle,
        canvasStyle,
        fittedCanvasStyle,
        measureWidths,
    };
}
