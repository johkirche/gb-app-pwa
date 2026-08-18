import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PanelTitle from './PanelTitle.vue';
import ResponsivePanel from './ResponsivePanel.vue';

/** Drives `useIsDesktop` — the panel branches on `(min-width: 64rem)`. */
let isDesktop = false;
const listeners = new Set<(event: MediaQueryListEvent) => void>();

function setViewport(desktop: boolean) {
    isDesktop = desktop;
    listeners.forEach((listener) => listener({ matches: desktop } as MediaQueryListEvent));
}

const popover = () => document.querySelector('[data-reka-popper-content-wrapper] [role="dialog"]');
const drawer = () => document.querySelector('[data-vaul-drawer]');

beforeEach(() => {
    listeners.clear();

    vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
            media: query,
            get matches() {
                return isDesktop;
            },
            addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
                listeners.add(listener),
            removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
                listeners.delete(listener),
        })),
    );

    // floating-ui (popover) and vaul (drawer) both need this in jsdom
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

function mountPanel() {
    return mount(
        defineComponent({
            setup: () => () =>
                h(
                    ResponsivePanel,
                    { open: true, label: 'Sortierung', anchor: document.createElement('button') },
                    () => [h(PanelTitle, () => 'Sortierung'), h('p', 'Nach Nummer')],
                ),
        }),
        { attachTo: document.body },
    );
}

describe('ResponsivePanel', () => {
    it('renders an anchored popover from the lg breakpoint up', async () => {
        setViewport(true);
        mountPanel();
        await nextTick();

        expect(drawer()).toBeNull();
        expect(popover()?.textContent).toContain('Nach Nummer');
    });

    it('names the popover, which reka would otherwise leave unlabelled', async () => {
        setViewport(true);
        mountPanel();
        await nextTick();

        expect(popover()?.getAttribute('aria-label')).toBe('Sortierung');
    });

    it('renders the bottom drawer below lg, still named by its title', async () => {
        setViewport(false);
        mountPanel();
        await nextTick();

        expect(popover()).toBeNull();

        // vaul/reka wire the accessible name themselves, off the DrawerTitle
        const labelledBy = drawer()?.getAttribute('aria-labelledby');
        expect(document.getElementById(labelledBy!)?.textContent).toBe('Sortierung');
    });

    it('swaps form when the viewport crosses the breakpoint', async () => {
        setViewport(false);
        mountPanel();
        await nextTick();
        expect(drawer()).not.toBeNull();

        setViewport(true);
        await nextTick();
        await nextTick();

        expect(drawer()).toBeNull();
        expect(popover()).not.toBeNull();
    });
});
