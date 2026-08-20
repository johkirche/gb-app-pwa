import { type Ref, computed, onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * How wide the drawn notation gets, for both melody views.
 *
 * The scale is applied as a width, never as a re-layout, so the system breaks
 * never move with it. Two widths come out of it: the notation is DRAWN at the
 * column times the scale, and the box that shows it grows with it —
 * symmetrically, out of the notation column and into the free width of the
 * page — until it reaches the page's edge. Only past that (phone widths, where
 * there is no free width to grow into) does the box stay put and the drawing
 * scroll inside it.
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

    const scrollBoxStyle = computed((): Record<string, string> => {
        if (drawnWidth.value === null || columnWidth.value === null) return {};
        const boxWidth = Math.min(drawnWidth.value, availableWidth.value ?? drawnWidth.value);
        return {
            width: `${boxWidth}px`,
            // Negative once the box outgrows the column: that is what lets it
            // spread to both sides instead of running off to the right.
            marginInline: `${(columnWidth.value - boxWidth) / 2}px`,
        };
    });

    const canvasStyle = computed(
        (): Record<string, string> =>
            drawnWidth.value === null ? {} : { width: `${drawnWidth.value}px` },
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

    return { columnWidth, drawnWidth, scrollBoxStyle, canvasStyle, measureWidths };
}
