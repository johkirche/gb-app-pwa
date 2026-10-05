import { flushPromises, mount } from '@vue/test-utils';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMarkierungenStore } from '@/stores/markierungen';

import { useVerseSelection } from '@/composables/useVerseSelection';

import { layoutChapter } from '@/utils/bibelLayout';

import BibelVerseActions from './BibelVerseActions.vue';

vi.mock('@/db', () => {
    const table = () => {
        const rows = new Map<string, { id: string }>();
        return {
            toArray: async () => [...rows.values()],
            put: async (row: { id: string }) => void rows.set(row.id, row),
            bulkPut: async (list: { id: string }[]) => list.forEach((r) => rows.set(r.id, r)),
            bulkDelete: async (ids: string[]) => ids.forEach((id) => rows.delete(id)),
            delete: async (id: string) => void rows.delete(id),
            clear: async () => rows.clear(),
        };
    };
    return { db: { lesezeichen: table(), markierungen: table(), meta: table() } };
});

const laid = layoutChapter([
    { p: [{ s: [{ v: 1 }, 'Der HERR ist mein Hirt.'] }, { s: [{ v: 2 }, 'Er weidet mich.'] }] },
]);

describe('BibelVerseActions', () => {
    const selection = useVerseSelection();

    beforeEach(() => {
        setActivePinia(createPinia());
        selection.attach({ slug: 'psalm', chapter: 23 }, laid);
    });

    it('stays out of the way until a verse is picked out', async () => {
        const wrapper = mount(BibelVerseActions);
        expect(wrapper.find('footer').exists()).toBe(false);

        selection.toggle(1);
        await flushPromises();
        expect(wrapper.find('footer').text()).toContain('Psalm 23,1');
    });

    it('copies the verses as a quotation, then lets go of them', async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        selection.toggle(1);
        selection.toggle(2);
        const wrapper = mount(BibelVerseActions);

        await wrapper
            .findAll('button')
            .find((b) => b.text() === 'Kopieren')!
            .trigger('click');
        await flushPromises();

        expect(writeText).toHaveBeenCalledWith(
            '„Der HERR ist mein Hirt. Er weidet mich.“ (Psalm 23,1-2, Menge)',
        );
        expect(selection.verses.value).toEqual([]);
    });

    it('highlights every verse picked out in the chosen colour', async () => {
        selection.toggle(1);
        selection.toggle(2);
        const wrapper = mount(BibelVerseActions);

        await wrapper
            .findAll('button')
            .find((b) => b.text() === 'Markieren')!
            .trigger('click');
        await wrapper.find('[aria-label="Blau"]').trigger('click');
        await flushPromises();

        const store = useMarkierungenStore();
        expect(store.colorOf('psalm', 23, 1)).toBe('blau');
        expect(store.colorOf('psalm', 23, 2)).toBe('blau');
    });

    it('hands extra actions what they act on', async () => {
        selection.toggle(2);
        const wrapper = mount(BibelVerseActions, {
            slots: {
                default: `<template #default="{ label, verses }">
                    <span class="extra">{{ label }}|{{ verses.join(',') }}</span>
                </template>`,
            },
        });
        expect(wrapper.find('.extra').text()).toBe('Psalm 23,2|2');
    });
});
