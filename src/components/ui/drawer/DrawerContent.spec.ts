import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Drawer from './Drawer.vue';
import DrawerContent from './DrawerContent.vue';

/**
 * A touch that the sheet takes for itself is one the drawer prevents, which is
 * what stops the browser turning it into a scroll and cancelling vaul's drag.
 * So `defaultPrevented` on the move is the whole observable here.
 */
const sheet = () => document.querySelector('[data-vaul-drawer]') as HTMLElement;
const body = () => document.querySelector('[data-vaul-drawer] .overflow-y-auto') as HTMLElement;

function touch(type: string, clientY: number): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: [{ clientY }] });
    return event;
}

/** jsdom lays nothing out, so the scrolled-away-from-top state has to be stated. */
function scrolledTo(el: HTMLElement, scrollTop: number) {
    Object.defineProperty(el, 'scrollTop', { value: scrollTop, configurable: true });
}

/** How far vaul is holding the sheet below its full height. */
function parkedAt(offset: number) {
    sheet().style.transform = `translate3d(0, ${offset}px, 0)`;
}

/** Returns whether the stroke was claimed for the sheet. */
function swipe(from: number, to: number): boolean {
    body().dispatchEvent(touch('touchstart', from));
    const move = touch('touchmove', to);
    body().dispatchEvent(move);
    return move.defaultPrevented;
}

beforeEach(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );

    // Only the Y translation matters, and jsdom ships no DOMMatrix to read it.
    vi.stubGlobal(
        'DOMMatrixReadOnly',
        class {
            m42: number;
            constructor(transform: string) {
                this.m42 = Number(/translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(transform)?.[1] ?? 0);
            }
        },
    );

    // The inline transform is what `parkedAt` sets; jsdom's computed style
    // does not carry it through.
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
        (el) => ({ transform: (el as HTMLElement).style.transform }) as CSSStyleDeclaration,
    );
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

async function mountDrawer() {
    mount(
        defineComponent({
            setup: () => () => h(Drawer, { open: true }, () => h(DrawerContent, () => 'Strophen')),
        }),
        { attachTo: document.body },
    );
    await nextTick();
    scrolledTo(body(), 0);
}

describe('DrawerContent', () => {
    it('takes a downward pull from the top of the body for the sheet', async () => {
        await mountDrawer();

        expect(swipe(400, 460)).toBe(true);
    });

    it('leaves a downward pull to the body while it is scrolled', async () => {
        await mountDrawer();
        scrolledTo(body(), 240);

        expect(swipe(400, 460)).toBe(false);
    });

    it('leaves an upward pull to the body when the sheet is already at full height', async () => {
        await mountDrawer();

        expect(swipe(400, 340)).toBe(false);
    });

    it('takes either direction while the sheet is parked on a snap point', async () => {
        await mountDrawer();
        parkedAt(220);

        expect(swipe(400, 340)).toBe(true);
        expect(swipe(400, 460)).toBe(true);
    });

    it('keeps a stroke it has taken, so dragging back up puts the sheet home', async () => {
        await mountDrawer();

        body().dispatchEvent(touch('touchstart', 400));
        body().dispatchEvent(touch('touchmove', 460));

        const backUp = touch('touchmove', 380);
        body().dispatchEvent(backUp);

        expect(backUp.defaultPrevented).toBe(true);
    });
});
