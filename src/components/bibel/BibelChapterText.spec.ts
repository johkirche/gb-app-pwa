import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMarkierungenStore } from '@/stores/markierungen';
import { useNotizenStore } from '@/stores/notizen';

import { useVerseSelection } from '@/composables/useVerseSelection';

import type { Block } from '@/utils/bibel';

import BibelChapterText from './BibelChapterText.vue';

// Empty in-memory tables: the stores load nothing and write nowhere.
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
    return {
        db: {
            lesezeichen: table(),
            markierungen: table(),
            notizen: table(),
            meta: table(),
        },
    };
});

// Verse 1 runs over two poetry lines; verse 2 has a footnote citing a passage.
const blocks: Block[] = [
    {
        p: [
            { s: [{ v: 1 }, { e: 'Ein Psalm von David.' }] },
            { s: ['Der HERR ist mein Hirt: mir mangelt nichts.'] },
            { s: [{ v: 2 }, 'Auf grünen Auen', { n: 'vgl. Hes 34,14' }, ' läßt er mich lagern.'] },
        ],
        q: 1,
    },
];

function render() {
    return mount(BibelChapterText, {
        props: { slug: 'psalm', chapter: 23, blocks },
        global: {
            stubs: {
                RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
                BibelNoteEditor: true,
            },
        },
        attachTo: document.body,
    });
}

describe('BibelChapterText', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('picks a verse out by its words, across its lines, and puts it back', async () => {
        const wrapper = render();
        const selection = useVerseSelection();

        await wrapper.find('[data-verse="1"]').trigger('click');
        expect(selection.verses.value).toEqual([1]);
        const picked = wrapper.findAll('.bibel-selected');
        expect(picked.map((el) => el.attributes('data-verse'))).toEqual(['1', '1']);

        await wrapper.findAll('[data-verse="1"]')[1].trigger('click');
        expect(selection.verses.value).toEqual([]);
        wrapper.unmount();
    });

    it('leaves the verse number to the Lesezeichen', async () => {
        const wrapper = render();
        await wrapper.find('#vers-2').trigger('click');
        expect(useVerseSelection().verses.value).toEqual([]);
        wrapper.unmount();
    });

    it('turns the references in an open footnote into links', async () => {
        const wrapper = render();
        await wrapper.find('.bibel-note-mark').trigger('click');
        const link = wrapper.find('.bibel-note a');
        expect(link.attributes('href')).toBe('/bibel/hesekiel/34?vers=14');
        expect(link.text()).toBe('Hes 34,14');
        wrapper.unmount();
    });

    it('washes a highlighted verse in its colour and puts its note after its last word', async () => {
        const wrapper = render();
        await useMarkierungenStore().setColor('psalm', 23, [1], 'gruen');
        await useNotizenStore().save('psalm', 23, 1, 'Taufspruch');
        await nextTick();

        const words = wrapper.findAll('[data-verse="1"]');
        expect(words.every((el) => el.classes('bibel-hl'))).toBe(true);
        expect(words[0].attributes('style')).toContain('var(--bibel-mark-gruen)');
        const icons = wrapper.findAll('.bibel-note-icon');
        expect(icons).toHaveLength(1);
        expect(icons[0].attributes('aria-label')).toBe('Notiz zu Vers 1');
        wrapper.unmount();
    });
});
