import type { Directive, DirectiveBinding } from 'vue';

interface LongPressHTMLElement extends HTMLElement {
    _longPressTimeout?: ReturnType<typeof setTimeout>;
    _longPressHandler?: (el: HTMLElement) => void;
    _longPressStart?: (e: TouchEvent) => void;
    _longPressEnd?: () => void;
}

const LONG_PRESS_DURATION = 500; // milliseconds

/**
 * Touch only, deliberately. Holding a mouse button down is not how anyone opens
 * a menu on a desktop — it also fires on an idle click-and-hold or the start of
 * a text selection, which is exactly the misfire this used to produce. The
 * pointer equivalents are the row's `⋯` button (see {@link RowActionsTrigger})
 * and the `contextmenu` event the rows also listen for.
 */
export const longPressDirective: Directive = {
    mounted(el: LongPressHTMLElement, binding: DirectiveBinding<(el: HTMLElement) => void>) {
        if (typeof binding.value !== 'function') {
            console.warn('v-long-press directive requires a function as its value');
            return;
        }

        let isLongPress = false;

        el._longPressHandler = binding.value;

        el._longPressStart = (_e: TouchEvent) => {
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
    },

    unmounted(el: LongPressHTMLElement) {
        if (el._longPressTimeout) {
            clearTimeout(el._longPressTimeout);
        }

        if (el._longPressStart) {
            el.removeEventListener('touchstart', el._longPressStart);
        }

        if (el._longPressEnd) {
            el.removeEventListener('touchend', el._longPressEnd);
            el.removeEventListener('touchcancel', el._longPressEnd);
            el.removeEventListener('touchmove', el._longPressEnd);
        }
    },
};
