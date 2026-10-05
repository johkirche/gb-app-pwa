import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useVerseSelection } from '@/composables/useVerseSelection';

import type { Block } from '@/utils/bibel';
import type { SecondaryVerse } from '@/utils/bibelParallel';

import BibelParallelText from './BibelParallelText.vue';

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
        db: { lesezeichen: table(), markierungen: table(), notizen: table(), meta: table() },
    };
});

// Menge has verses 1 and 2 under a heading; Luther has 1 (counted as his 2,28) and 3.
const blocks: Block[] = [
    { h: 3, t: 'Die Ausgießung des Geistes' },
    {
        p: [
            { s: [{ v: 1 }, 'Und danach wird es geschehen.'] },
            { s: [{ v: 2 }, 'Auch über die Knechte.'] },
        ],
    },
];
const secondary = new Map<number, SecondaryVerse>([
    [1, { verse: 1, own: { chapter: 2, verse: 28 }, text: 'Und nach diesem will ich.' }],
    [3, { verse: 3, own: { chapter: 2, verse: 30 }, text: 'Und will Wunderzeichen geben.' }],
]);

function render() {
    return mount(BibelParallelText, {
        props: {
            slug: 'joel',
            chapter: 3,
            blocks,
            secondary,
            primaryLabel: 'Menge-Bibel (1939)',
            secondaryLabel: 'Lutherbibel (1912)',
        },
        global: {
            stubs: {
                RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
                BibelNoteEditor: true,
            },
        },
        attachTo: document.body,
    });
}

describe('BibelParallelText', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('sets the heading, then verse beside verse, with honest gaps', () => {
        const wrapper = render();
        expect(wrapper.find('h3').text()).toBe('Die Ausgießung des Geistes');
        const rows = wrapper.findAll('.bibel-row');
        expect(rows).toHaveLength(3);
        expect(rows[0].text()).toContain('Und nach diesem will ich.');
        // Luther's own count, where it is not Menge's.
        expect(rows[0].find('.bibel-secondary-verse').text()).toBe('2,28');
        expect(rows[1].find('.bibel-secondary').text()).toContain('Bei Luther nicht vorhanden');
        expect(rows[2].text()).toContain('Bei Menge nicht vorhanden');
        wrapper.unmount();
    });

    it('keeps only Menge’s verse numbers addressable and Menge’s words selectable', async () => {
        const wrapper = render();
        expect(wrapper.findAll('[id^="vers-"]').map((el) => el.attributes('id'))).toEqual([
            'vers-1',
            'vers-2',
        ]);
        expect(wrapper.findAll('[data-verse]')).toHaveLength(2);

        const selection = useVerseSelection();
        await wrapper.find('[data-verse="2"]').trigger('click');
        await nextTick();
        expect(selection.verses.value).toEqual([2]);
        expect(selection.here.value).toEqual({ slug: 'joel', chapter: 3 });
        expect(wrapper.find('[data-verse="2"]').classes()).toContain('bibel-selected');
        wrapper.unmount();
    });
});
