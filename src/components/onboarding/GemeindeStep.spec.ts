import { flushPromises, mount } from '@vue/test-utils';
import { computed, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GemeindeRef } from '@/utils/gemeinden';

/**
 * What the step may write. The one that matters is the reader who presses on
 * without touching anything: on a new device the profile may not have come down
 * yet, and „Weiter" must not clear the Gemeinde the account already has.
 */

const accountGemeinde = ref<GemeindeRef | null>(null);
const saveProfile = vi.fn();
const warning = vi.fn();

vi.mock('@/composables/useProfile', () => ({
    useProfile: () => ({
        gemeinde: computed(() => accountGemeinde.value),
        saveProfile: (...a: unknown[]) => saveProfile(...a),
    }),
}));
vi.mock('vue-sonner', () => ({ toast: { warning: (...a: unknown[]) => warning(...a) } }));

const { default: GemeindeStep } = await import('./GemeindeStep.vue');

const BREMEN = { id: 'g1', name: 'Bremen' };
const PICKER = { name: 'GemeindePicker', props: ['modelValue'], template: '<div />' };

function mountStep() {
    return mount(GemeindeStep, { global: { stubs: { GemeindePicker: PICKER } } });
}

async function pressOn(wrapper: ReturnType<typeof mountStep>) {
    await wrapper.find('button').trigger('click');
    await flushPromises();
}

beforeEach(() => {
    vi.clearAllMocks();
    accountGemeinde.value = null;
    saveProfile.mockResolvedValue(true);
});

describe('the Gemeinde step', () => {
    it('writes nothing for a reader who presses on without choosing', async () => {
        const wrapper = mountStep();
        await pressOn(wrapper);
        expect(saveProfile).not.toHaveBeenCalled();
        expect(wrapper.emitted('next')).toHaveLength(1);
    });

    it('shows what the account says as soon as it comes down', async () => {
        const wrapper = mountStep();
        accountGemeinde.value = BREMEN;
        await flushPromises();
        expect(wrapper.findComponent(PICKER).props('modelValue')).toEqual(BREMEN);

        await pressOn(wrapper);
        expect(saveProfile).not.toHaveBeenCalled();
    });

    it('saves what the reader chose', async () => {
        const wrapper = mountStep();
        wrapper.findComponent(PICKER).vm.$emit('update:modelValue', BREMEN);
        await pressOn(wrapper);
        expect(saveProfile).toHaveBeenCalledWith({ gemeinde: BREMEN });
        expect(wrapper.emitted('next')).toHaveLength(1);
    });

    it('takes a chosen Gemeinde back when the reader says none', async () => {
        accountGemeinde.value = BREMEN;
        const wrapper = mountStep();
        wrapper.findComponent(PICKER).vm.$emit('update:modelValue', null);
        await pressOn(wrapper);
        expect(saveProfile).toHaveBeenCalledWith({ gemeinde: null });
    });

    it('says so when the account refuses, and goes on all the same', async () => {
        saveProfile.mockResolvedValue(false);
        const wrapper = mountStep();
        wrapper.findComponent(PICKER).vm.$emit('update:modelValue', BREMEN);
        await pressOn(wrapper);
        expect(warning).toHaveBeenCalledOnce();
        expect(wrapper.emitted('next')).toHaveLength(1);
    });
});
