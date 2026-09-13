import { mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { longPressDirective } from './longPress';

/**
 * jsdom has no TouchEvent, and the directive only reads the event's type.
 */
function touch(el: Element, type: 'touchstart' | 'touchend' | 'touchmove' | 'touchcancel') {
    el.dispatchEvent(new Event(type, { bubbles: true }));
}

function mountRow(handler: (el: HTMLElement) => void) {
    return mount(
        {
            template: `<button v-long-press="handler" type="button">Lied</button>`,
            props: { handler: { type: Function, required: true } },
        },
        {
            props: { handler },
            global: { directives: { 'long-press': longPressDirective } },
        },
    );
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('v-long-press', () => {
    it('fires after a held touch, handing over the pressed element as the anchor', () => {
        const handler = vi.fn();
        const wrapper = mountRow(handler);
        const el = wrapper.element;

        touch(el, 'touchstart');
        vi.advanceTimersByTime(600);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(el);
    });

    it('does not fire when the touch ends, moves or is cancelled first', () => {
        for (const ending of ['touchend', 'touchmove', 'touchcancel'] as const) {
            const handler = vi.fn();
            const el = mountRow(handler).element;

            touch(el, 'touchstart');
            vi.advanceTimersByTime(300);
            touch(el, ending);
            vi.advanceTimersByTime(600);

            expect(handler, ending).not.toHaveBeenCalled();
        }
    });

    /**
     * The desktop way in is the row's `⋯` button, not a held mouse button:
     * holding one down is how a text selection or an idle click starts, and
     * opening a menu under either was the misfire this guards against.
     */
    it('ignores a held mouse button', () => {
        const handler = vi.fn();
        const el = mountRow(handler).element;

        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        vi.advanceTimersByTime(2000);

        expect(handler).not.toHaveBeenCalled();
    });

    it('swallows the click a long press synthesises, so the row does not also open', () => {
        const handler = vi.fn();
        const onClick = vi.fn();
        const el = mountRow(handler).element;
        el.addEventListener('click', onClick);

        touch(el, 'touchstart');
        vi.advanceTimersByTime(600);
        touch(el, 'touchend');
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(onClick).not.toHaveBeenCalled();
    });
});
