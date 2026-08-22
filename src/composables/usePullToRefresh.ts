import { type Ref, computed, onBeforeUnmount, ref, watch } from 'vue';

interface PullToRefreshOptions {
    /** How far the finger has to travel before releasing triggers a refresh. */
    threshold?: number;
    /** Where the indicator stops following the finger. */
    maxDistance?: number;
    /** Height the indicator holds while the refresh runs. */
    restingDistance?: number;
    /** Called on every touchstart — return false to sit the gesture out. */
    enabled?: () => boolean;
}

/**
 * Pull-to-refresh for a scroll container, in the shape phones have taught:
 * drag down from the very top, release past the threshold, the indicator holds
 * its place until the work is done.
 *
 * The gesture is claimed (preventDefault) only once the finger is clearly
 * heading downwards from scrollTop 0 — a sideways or upward move stays with the
 * browser, so ordinary scrolling is untouched.
 */
export function usePullToRefresh(
    target: Ref<HTMLElement | null>,
    onRefresh: () => Promise<unknown>,
    options: PullToRefreshOptions = {},
) {
    const {
        threshold = 64,
        maxDistance = 96,
        restingDistance = 56,
        enabled = () => true,
    } = options;

    /** How far the indicator is currently pulled open, in pixels. */
    const distance = ref(0);
    const isRefreshing = ref(false);
    /** True while a finger is actually dragging the indicator open. */
    const isPulling = ref(false);
    const isArmed = computed(() => distance.value >= threshold);

    let startY = 0;
    let tracking = false;
    let claimed = false;

    function onTouchStart(event: TouchEvent) {
        if (isRefreshing.value || event.touches.length !== 1 || !enabled()) return;
        const el = target.value;
        if (!el || el.scrollTop > 0) return;

        startY = event.touches[0].clientY;
        tracking = true;
        claimed = false;
    }

    function onTouchMove(event: TouchEvent) {
        if (!tracking) return;

        const el = target.value;
        const delta = event.touches[0].clientY - startY;

        // Scrolling back up (or the list having scrolled away underneath)
        // hands the gesture back to the browser for good.
        if (delta <= 0 || !el || el.scrollTop > 0) {
            reset();
            return;
        }

        claimed = true;
        isPulling.value = true;
        // Rubber band: the pull gets heavier the further it goes, and stops
        // short of maxDistance however hard it is dragged.
        distance.value = Math.min(maxDistance, maxDistance * (1 - Math.exp(-delta / maxDistance)));

        if (event.cancelable) event.preventDefault();
    }

    async function onTouchEnd() {
        if (!tracking) return;
        tracking = false;
        isPulling.value = false;

        if (!claimed || !isArmed.value) {
            distance.value = 0;
            return;
        }

        isRefreshing.value = true;
        distance.value = restingDistance;
        try {
            await onRefresh();
        } finally {
            isRefreshing.value = false;
            distance.value = 0;
        }
    }

    function reset() {
        tracking = false;
        claimed = false;
        isPulling.value = false;
        if (!isRefreshing.value) distance.value = 0;
    }

    function attach(el: HTMLElement) {
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        // Not passive: the drag has to be able to keep the page from scrolling.
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', reset);
    }

    function detach(el: HTMLElement) {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        el.removeEventListener('touchcancel', reset);
    }

    watch(
        target,
        (el, previous) => {
            if (previous) detach(previous);
            if (el) attach(el);
        },
        { immediate: true },
    );

    onBeforeUnmount(() => {
        if (target.value) detach(target.value);
    });

    return { distance, isRefreshing, isPulling, isArmed, threshold };
}
