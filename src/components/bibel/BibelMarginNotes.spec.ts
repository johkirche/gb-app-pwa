import { flushPromises, mount } from '@vue/test-utils';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotizenStore } from '@/stores/notizen';

import { useVerseSelection } from '@/composables/useVerseSelection';

import BibelMarginNotes from './BibelMarginNotes.vue';

vi.mock('@/db', () => {
    const rows = new Map<string, { id: string }>();
    return {
        db: {
            notizen: {
                toArray: async () => [...rows.values()],
                put: async (row: { id: string }) => void rows.set(row.id, row),
                delete: async (id: string) => void rows.delete(id),
                clear: async () => rows.clear(),
            },
        },
    };
});

/** A column with three verses, as the chapter text lays them out. */
function column(): HTMLElement {
    const el = document.createElement('article');
    el.innerHTML = [1, 2, 3].map((v) => `<p><span data-verse="${v}">Vers ${v}</span></p>`).join('');
    return el;
}

describe('BibelMarginNotes', () => {
    beforeEach(async () => {
        setActivePinia(createPinia());
        await useNotizenStore().clearAll();
        useVerseSelection().closeNote();
    });

    it("shows this chapter's notes in verse order, and opens one to edit", async () => {
        const notizen = useNotizenStore();
        await notizen.save('psalm', 23, 3, 'Auf rechten Pfaden.');
        await notizen.save('psalm', 23, 1, 'Mein Hirt.');
        await notizen.save('psalm', 24, 1, 'Ein anderes Kapitel.');

        const wrapper = mount(BibelMarginNotes, {
            props: { slug: 'psalm', chapter: 23, column: column() },
        });
        await flushPromises();

        const cards = wrapper.findAll('button');
        expect(cards.map((c) => c.text())).toEqual([
            'Vers 1Mein Hirt.',
            'Vers 3Auf rechten Pfaden.',
        ]);

        await cards[1].trigger('click');
        expect(useVerseSelection().noteVerse.value).toBe(3);
    });

    it('leaves out a note whose verse is not in the text', async () => {
        await useNotizenStore().save('psalm', 23, 9, 'Gibt es hier nicht.');
        const wrapper = mount(BibelMarginNotes, {
            props: { slug: 'psalm', chapter: 23, column: column() },
        });
        await flushPromises();
        expect(wrapper.findAll('button')).toHaveLength(0);
    });
});
