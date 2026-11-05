import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { ref, shallowRef } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GemeindeOption, GemeindeRef } from '@/utils/gemeinden';

/**
 * Which scroll chooses. Scrolling by hand picks a row; a keyboard or a screen reader
 * scrolls too on its way from row to row, and the picker does itself when it brings
 * a row into place, and none of those may change the answer. A page without layout
 * has every row at the top, so a scroll that counts lands on „Keine Angabe"; which
 * row a position means is measured in tests/e2e/readability-scale.spec.ts.
 */

const BREMEN: GemeindeOption = { id: 'g1', name: 'Bremen', place: null, point: { x: 1, y: 1 } };
const JENA: GemeindeOption = { id: 'g2', name: 'Jena', place: null, point: { x: 2, y: 2 } };

const gemeinden = shallowRef<GemeindeOption[]>([BREMEN, JENA]);
const listState = ref('ready');

vi.mock('@/composables/useGemeinden', () => ({
    useGemeinden: () => ({ gemeinden, listState, load: () => Promise.resolve() }),
}));

const { default: GemeindePicker } = await import('./GemeindePicker.vue');

const MAP = { name: 'GemeindeMap', props: ['gemeinden', 'selected'], template: '<i />' };

const scrollTo = vi.fn();

// Each mount listens on the window, and a picker left over would answer too.
enableAutoUnmount(afterEach);

function mountPicker(modelValue: GemeindeRef | null) {
    return mount(GemeindePicker, {
        props: { modelValue },
        global: { stubs: { GemeindeMap: MAP } },
        attachTo: document.body,
    });
}

function scroll() {
    document.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
    vi.clearAllMocks();
    listState.value = 'ready';
    Element.prototype.scrollTo = scrollTo;
    window.matchMedia = vi.fn(() => ({ matches: false })) as never;
    // Room to scroll: the picker leaves a list alone that fits the screen.
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
});

describe('the Gemeinde picker', () => {
    it('chooses when the reader scrolls by wheel', async () => {
        const wrapper = mountPicker({ id: 'g1', name: 'Bremen' });
        await flushPromises();
        window.dispatchEvent(new Event('wheel'));
        scroll();
        expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
    });

    it('chooses when the reader scrolls by finger', async () => {
        const wrapper = mountPicker({ id: 'g1', name: 'Bremen' });
        await flushPromises();
        window.dispatchEvent(new Event('touchmove'));
        scroll();
        expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
    });

    it('chooses nothing for a scroll no hand made, as a screen reader causes', async () => {
        const wrapper = mountPicker({ id: 'g1', name: 'Bremen' });
        await flushPromises();
        scroll();
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('chooses nothing for the scroll a key causes', async () => {
        const wrapper = mountPicker({ id: 'g1', name: 'Bremen' });
        await flushPromises();
        window.dispatchEvent(new Event('wheel'));
        await wrapper.find('[role="radio"]').trigger('keydown', { key: 'ArrowDown' });
        scroll();
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('does not say it twice while the same row stays in place', async () => {
        const wrapper = mountPicker(null);
        await flushPromises();
        window.dispatchEvent(new Event('wheel'));
        scroll();
        scroll();
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('takes a tapped row, and is not talked out of it by the scroll that follows', async () => {
        const wrapper = mountPicker(null);
        await flushPromises();
        window.dispatchEvent(new Event('wheel'));
        await wrapper.findAll('[role="radio"]')[1].trigger('click');
        await flushPromises();
        scroll();

        expect(wrapper.emitted('update:modelValue')).toEqual([[{ id: 'g1', name: 'Bremen' }]]);
        expect(scrollTo).toHaveBeenCalledOnce();
        expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    });

    it('moves without animation for a reader who asked for less movement', async () => {
        window.matchMedia = vi.fn(() => ({ matches: true })) as never;
        const wrapper = mountPicker(null);
        await flushPromises();
        await wrapper.findAll('[role="radio"]')[1].trigger('click');
        expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    });

    it('goes back to the whole country and the top for „Keine Angabe"', async () => {
        const wrapper = mountPicker({ id: 'g1', name: 'Bremen' });
        await flushPromises();
        scrollTo.mockClear();
        await wrapper.findAll('[role="radio"]')[0].trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
        expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });

    it('brings a saved Gemeinde into place at once, with the map on it', async () => {
        const wrapper = mountPicker({ id: 'g2', name: 'Jena' });
        await flushPromises();
        expect(wrapper.findComponent(MAP).props('selected')).toEqual(JENA);
        expect(scrollTo).toHaveBeenCalledOnce();
        expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    });

    it('does the same for one that comes down from the account later', async () => {
        const wrapper = mountPicker(null);
        await flushPromises();
        expect(scrollTo).not.toHaveBeenCalled();

        await wrapper.setProps({ modelValue: { id: 'g1', name: 'Bremen' } });
        await flushPromises();
        expect(wrapper.findComponent(MAP).props('selected')).toEqual(BREMEN);
        expect(scrollTo).toHaveBeenCalledOnce();
    });

    it('waits for the list before it looks for the row', async () => {
        listState.value = 'loading';
        const wrapper = mountPicker({ id: 'g2', name: 'Jena' });
        await flushPromises();
        expect(scrollTo).not.toHaveBeenCalled();

        listState.value = 'ready';
        await flushPromises();
        expect(wrapper.findComponent(MAP).props('selected')).toEqual(JENA);
        expect(scrollTo).toHaveBeenCalledOnce();
    });

    it('does not move the list for a choice it made itself', async () => {
        const wrapper = mountPicker({ id: 'g1', name: 'Bremen' });
        await flushPromises();
        scrollTo.mockClear();
        window.dispatchEvent(new Event('wheel'));
        scroll();

        // The parent hands the choice back in, as v-model does.
        await wrapper.setProps({ modelValue: null });
        await flushPromises();
        expect(scrollTo).not.toHaveBeenCalled();
    });
});
