import { type Ref, onActivated, onDeactivated, watch } from 'vue';

/** What the shell's overlays read to stay clear of the app's own bottom chrome. */
const PROPERTY = '--app-bottom-inset';

/**
 * Publishes how much of the viewport's bottom edge the app's own chrome covers.
 *
 * Toasts belong to the shell rather than to a route: they are positioned
 * against the viewport and know nothing of the tab bar they would otherwise
 * land on. This hands them a length to keep above — what the bar actually
 * occupies, its safe-area padding included, so a reader that adds the safe area
 * itself (sonner does, on narrow viewports) has to take that part back off.
 */
export function useBottomBarInset(bar: Ref<HTMLElement | null>) {
    const publish = (height: number) =>
        document.documentElement.style.setProperty(PROPERTY, `${height}px`);

    /** Hidden by the breakpoint, or detached, the bar has no box — and covers nothing. */
    const measure = () => publish(bar.value?.offsetHeight ?? 0);

    watch(
        bar,
        (el, _prev, onCleanup) => {
            if (!el) return measure();

            // The bar grows and shrinks with its own contents (the Gottesdienst
            // tab comes and goes), so the height is watched rather than read once.
            const observer = new ResizeObserver(measure);
            observer.observe(el);
            measure();

            onCleanup(() => {
                observer.disconnect();
                publish(0);
            });
        },
        { immediate: true, flush: 'post' },
    );

    // Kept alive under a standalone route the bar stays mounted but detached,
    // with nothing of it on screen to keep clear of.
    onActivated(measure);
    onDeactivated(() => publish(0));
}
