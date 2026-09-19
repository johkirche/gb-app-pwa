import { nextTick } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreferencesStore } from '@/stores/preferences';

import { applyPageScale, usePageScale } from '@/composables/usePageScale';

const readScale = () => document.documentElement.style.getPropertyValue('--page-scale');

describe('usePageScale', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        document.documentElement.style.removeProperty('--page-scale');
    });

    it('puts the scale on the root element', () => {
        applyPageScale(1.4);
        expect(readScale()).toBe('1.4');
    });

    it('applies whatever is stored before the first paint', () => {
        const preferences = usePreferencesStore();
        preferences.$patch({ pageScale: 1.7 });

        usePageScale();

        expect(readScale()).toBe('1.7');
    });

    it('follows the setting while the app runs', async () => {
        const preferences = usePreferencesStore();
        usePageScale();
        expect(readScale()).toBe('1');

        // What both the Einstellungen slider and the song page's menu leave
        // behind once setPageScale has clamped and stored the new value.
        preferences.$patch({ pageScale: 0.8 });
        await nextTick();

        expect(readScale()).toBe('0.8');
    });
});
