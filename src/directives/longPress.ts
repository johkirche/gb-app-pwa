import type { Directive, DirectiveBinding } from 'vue';

interface LongPressHTMLElement extends HTMLElement {
    _longPressTimeout?: ReturnType<typeof setTimeout>;
    _longPressHandler?: (el: HTMLElement) => void;
    _longPressStart?: (e: TouchEvent | MouseEvent) => void;
    _longPressEnd?: () => void;
}

const LONG_PRESS_DURATION = 500; // milliseconds

/**
 * The dev mobile preview is an ordinary iframe, so a mouse inside it stays a
 * mouse and the gesture the frame exists to rehearse would be the one thing
 * the frame could not show. Honour a held button there — and only there. The
 * class is set by DevViewportPreview on the framed instance alone, and a
 * production build drops that component entirely.
 */
function isViewportPreview(): boolean {
    return document.documentElement.classList.contains('viewport-preview');
}

/**
 * Touch only, deliberately (bar the preview above). Holding a mouse button down
 * is not how anyone opens a menu on a desktop — it also fires on an idle
 * click-and-hold or the start of a text selection, which is exactly the misfire
 * this used to produce. The pointer equivalents are the row's `⋯` button (see
 * {@link RowActionsTrigger}) and the `contextmenu` event the rows also listen
 * for.
 */
export const longPressDirective: Directive = {
    mounted(el: LongPressHTMLElement, binding: DirectiveBinding<(el: HTMLElement) => void>) {
        if (typeof binding.value !== 'function') {
            console.warn('v-long-press directive requires a function as its value');
            return;
        }

        let isLongPress = false;

        el._longPressHandler = binding.value;

        el._longPressStart = (event: TouchEvent | MouseEvent) => {
            if (event.type === 'mousedown' && !isViewportPreview()) return;

            isLongPress = false;

            el._longPressTimeout = setTimeout(() => {
                isLongPress = true;
                // The pressed element doubles as the anchor for the menu that opens
                el._longPressHandler?.(el);
                // Add haptic feedback if available
                if ('vibrate' in navigator) {
                    navigator.vibrate(50);
                }
            }, LONG_PRESS_DURATION);
        };

        el._longPressEnd = () => {
            if (el._longPressTimeout) {
                clearTimeout(el._longPressTimeout);
                el._longPressTimeout = undefined;
            }
        };

        // Prevent the click a finished touch still synthesises after a long press
        el.addEventListener(
            'click',
            (e: MouseEvent) => {
                if (isLongPress) {
                    e.preventDefault();
                    e.stopPropagation();
                    isLongPress = false;
                }
            },
            true,
        );

        el.addEventListener('touchstart', el._longPressStart, { passive: true });
        el.addEventListener('touchend', el._longPressEnd);
        el.addEventListener('touchcancel', el._longPressEnd);
        el.addEventListener('touchmove', el._longPressEnd);

        el.addEventListener('mousedown', el._longPressStart);
        el.addEventListener('mouseup', el._longPressEnd);
        el.addEventListener('mouseleave', el._longPressEnd);
    },

    unmounted(el: LongPressHTMLElement) {
        if (el._longPressTimeout) {
            clearTimeout(el._longPressTimeout);
        }

        if (el._longPressStart) {
            el.removeEventListener('touchstart', el._longPressStart);
            el.removeEventListener('mousedown', el._longPressStart);
        }

        if (el._longPressEnd) {
            el.removeEventListener('touchend', el._longPressEnd);
            el.removeEventListener('touchcancel', el._longPressEnd);
            el.removeEventListener('touchmove', el._longPressEnd);
            el.removeEventListener('mouseup', el._longPressEnd);
            el.removeEventListener('mouseleave', el._longPressEnd);
        }
    },
};
