import type { Directive, DirectiveBinding } from 'vue';

interface LongPressHTMLElement extends HTMLElement {
    _longPressTimeout?: ReturnType<typeof setTimeout>;
    _longPressHandler?: (el: HTMLElement) => void;
    _longPressStart?: (e: TouchEvent | MouseEvent) => void;
    _longPressEnd?: () => void;
}

const LONG_PRESS_DURATION = 500; // milliseconds

export const longPressDirective: Directive = {
    mounted(el: LongPressHTMLElement, binding: DirectiveBinding<(el: HTMLElement) => void>) {
        if (typeof binding.value !== 'function') {
            console.warn('v-long-press directive requires a function as its value');
            return;
        }

        let isLongPress = false;

        el._longPressHandler = binding.value;

        el._longPressStart = (_e: TouchEvent | MouseEvent) => {
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

        // Prevent click if it was a long press
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

        // Touch events
        el.addEventListener('touchstart', el._longPressStart, { passive: true });
        el.addEventListener('touchend', el._longPressEnd);
        el.addEventListener('touchcancel', el._longPressEnd);
        el.addEventListener('touchmove', el._longPressEnd);

        // Mouse events (for desktop)
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
