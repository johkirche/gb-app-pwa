import { type Ref, onBeforeUnmount, onMounted } from 'vue';

/**
 * A horizontal swipe across a page, read as „nächstes" or „vorheriges".
 *
 * The gesture has to live alongside two other horizontal movements on the song
 * page: the notation, which scrolls sideways once it has been enlarged past the
 * column, and the page's own vertical scroll, which a thumb rarely draws
 * perfectly straight. Both are settled here rather than in the page:
 *
 *  - a swipe that begins inside a box that can scroll sideways is that box's
 *    to handle, however it ends — the reader was dragging notes, not pages
 *  - a movement is only a page swipe when it is clearly wider than it is
 *    tall, long enough to be meant, and quick enough to be a flick
 */
export type SwipeDirection = 'left' | 'right';

export interface SwipeSample {
    x: number;
    y: number;
    /** Milliseconds, on any clock as long as start and end share it */
    time: number;
}

export interface SwipeThresholds {
    /** Least horizontal travel in px for a swipe to count */
    minDistance: number;
    /** How much wider than tall the movement has to be */
    minRatio: number;
    /** Most time in ms between touchstart and touchend */
    maxDuration: number;
}

export const DEFAULT_SWIPE_THRESHOLDS: SwipeThresholds = {
    minDistance: 64,
    minRatio: 2,
    maxDuration: 700,
};

/**
 * What a movement from `start` to `end` amounts to, or null where it is a
 * scroll, a tap or a slow drag rather than a swipe.
 */
export function classifySwipe(
    start: SwipeSample,
    end: SwipeSample,
    thresholds: SwipeThresholds = DEFAULT_SWIPE_THRESHOLDS,
): SwipeDirection | null {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (end.time - start.time > thresholds.maxDuration) return null;
    if (Math.abs(dx) < thresholds.minDistance) return null;
    if (Math.abs(dx) < Math.abs(dy) * thresholds.minRatio) return null;

    return dx < 0 ? 'left' : 'right';
}

/**
 * Whether `target` sits inside an element that scrolls sideways — that is, one
 * whose content is wider than itself and whose overflow-x lets it move. The
 * walk stops at `boundary`, which is the swipe surface itself.
 */
export function startsInHorizontalScroller(target: EventTarget | null, boundary: Element): boolean {
    let el = target instanceof Element ? target : null;

    while (el && el !== boundary) {
        if (el.scrollWidth > el.clientWidth + 1) {
            const overflowX = getComputedStyle(el).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll') return true;
        }
        el = el.parentElement;
    }

    return false;
}

export interface SwipeNavigationHandlers {
    /** Finger moved right to left: the page after this one */
    onSwipeLeft: () => void;
    /** Finger moved left to right: the page before this one */
    onSwipeRight: () => void;
}

/**
 * Listen for page swipes on `surface`. Touch only: a mouse has the buttons and
 * the arrow keys, and a trackpad's horizontal scroll is the browser's back
 * gesture already.
 */
export function useSwipeNavigation(
    surface: Ref<HTMLElement | null>,
    handlers: SwipeNavigationHandlers,
    thresholds: SwipeThresholds = DEFAULT_SWIPE_THRESHOLDS,
): void {
    let start: SwipeSample | null = null;
    let attached: HTMLElement | null = null;

    function onTouchStart(event: TouchEvent) {
        // A second finger is a pinch, not a swipe.
        if (event.touches.length !== 1 || !attached) {
            start = null;
            return;
        }
        if (startsInHorizontalScroller(event.target, attached)) {
            start = null;
            return;
        }
        const touch = event.touches[0];
        start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
    }

    function onTouchEnd(event: TouchEvent) {
        if (!start) return;
        const touch = event.changedTouches[0];
        const direction = classifySwipe(
            start,
            { x: touch.clientX, y: touch.clientY, time: event.timeStamp },
            thresholds,
        );
        start = null;

        if (direction === 'left') handlers.onSwipeLeft();
        else if (direction === 'right') handlers.onSwipeRight();
    }

    function onTouchCancel() {
        start = null;
    }

    function attach() {
        const el = surface.value;
        if (!el || el === attached) return;
        detach();
        attached = el;
        // Passive: the page must keep scrolling under the finger; the swipe is
        // only read off where it ended.
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    }

    function detach() {
        if (!attached) return;
        attached.removeEventListener('touchstart', onTouchStart);
        attached.removeEventListener('touchend', onTouchEnd);
        attached.removeEventListener('touchcancel', onTouchCancel);
        attached = null;
        start = null;
    }

    onMounted(attach);
    onBeforeUnmount(detach);
}
