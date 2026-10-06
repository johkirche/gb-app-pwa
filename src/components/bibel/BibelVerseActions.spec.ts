import { flushPromises, mount } from '@vue/test-utils';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    return {
        db: {
            lesezeichen: table(),
            markierungen: table(),
            meta: table(),
            playlists: table(),
            services: table(),
        },
    };
});

const laid = layoutChapter([
    { p: [{ s: [{ v: 1 }, 'Der HERR ist mein Hirt.'] }, { s: [{ v: 2 }, 'Er weidet mich.'] }] },
]);

/** The drawer is portalled to the end of the page, not inside the component. */
function sheet(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-vaul-drawer]');
}

function button(text: string): HTMLButtonElement {
    const found = [...(sheet()?.querySelectorAll('button') ?? [])].find(
        (b) => b.textContent?.trim() === text,
    );
    if (!found) throw new Error(`no button "${text}" in the sheet`);
    return found;
}

describe('BibelVerseActions', () => {
    const selection = useVerseSelection();
    let wrapper: ReturnType<typeof mount> | null = null;

    beforeEach(() => {
        setActivePinia(createPinia());
        selection.attach({ slug: 'psalm', chapter: 23 }, laid);
        selection.clear();
    });

    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
    });

    function open() {
        wrapper = mount(BibelVerseActions, { attachTo: document.body });
        return flushPromises();
    }

    it('stays out of the way until a verse is picked out', async () => {
        await open();
        expect(sheet()).toBeNull();

        selection.toggle(1);
        await flushPromises();
        expect(sheet()?.textContent).toContain('Psalm 23,1');
    });

    it('copies the verses as a quotation, then lets go of them', async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        selection.toggle(1);
        selection.toggle(2);
        await open();

        button('Kopieren').click();
        await flushPromises();

        expect(writeText).toHaveBeenCalledWith(
            '„Der HERR ist mein Hirt. Er weidet mich.“ (Psalm 23,1-2, Menge)',
        );
        expect(selection.verses.value).toEqual([]);
    });

    it('highlights every verse picked out in the chosen colour', async () => {
        selection.toggle(1);
        selection.toggle(2);
        await open();

        sheet()!.querySelector<HTMLButtonElement>('[aria-label="Blau"]')!.click();
        await flushPromises();

        const store = useMarkierungenStore();
        expect(store.colorOf('psalm', 23, 1)).toBe('blau');
        expect(store.colorOf('psalm', 23, 2)).toBe('blau');
    });

    it('lists every action switched on, each spelt out', async () => {
        selection.toggle(1);
        await open();

        const labels = [...sheet()!.querySelectorAll('li > button')].map((b) =>
            b.textContent?.trim(),
        );
        expect(labels).toEqual([
            'Kopieren',
            'Teilen',
            'Notiz schreiben',
            'Lesezeichen setzen',
            'Zum Gottesdienst',
        ]);
        expect(sheet()!.textContent).toContain('Markieren');
        expect(sheet()!.textContent).toContain('Weitere Verse antippen');
    });

    it('on a desktop, stands beside the text as a panel, and lets go on Escape', async () => {
        // jsdom has no matchMedia; this one says every query matches.
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: (query: string) => ({
                matches: true,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
            }),
        });
        selection.toggle(1);
        selection.toggle(2);
        await open();

        expect(sheet()).toBeNull();
        const panel = wrapper!.find('aside');
        expect(panel.text()).toContain('Psalm 23,1-2');
        expect(panel.text()).toContain('Weitere Verse anklicken');
        expect(panel.findAll('li > button').map((b) => b.text())).toContain('Kopieren');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(selection.verses.value).toEqual([]);
        delete (window as { matchMedia?: unknown }).matchMedia;
    });
});
