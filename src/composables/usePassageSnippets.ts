import { reactive, watch } from 'vue';

import type { BibelPassage } from '@/db';
import { loadBook } from '@/utils/bibel';
import { layoutChapter, snippet, verseText, versesOf } from '@/utils/bibelLayout';
import { passageKey } from '@/utils/bibelPassage';

/**
 * The opening words of each passage, by passageKey, so the reader can tell the
 * readings apart at a glance. Read from the book where it is on the device;
 * where it is not, the entry stays empty and the reference stands alone.
 */
export function usePassageSnippets(passages: () => BibelPassage[]): Record<string, string> {
    const snippets = reactive<Record<string, string>>({});

    async function load(passage: BibelPassage) {
        const key = passageKey(passage);
        if (key in snippets) return;
        snippets[key] = '';
        try {
            const chapters = await loadBook(passage.slug);
            const laid = layoutChapter(chapters[passage.chapter - 1] ?? []);
            const all = versesOf(laid);
            const from = passage.verse ?? all[0] ?? 1;
            const to = passage.endVerse ?? passage.verse ?? all.at(-1) ?? from;
            const text = all
                .filter((v) => v >= from && v <= to)
                .map((v) => verseText(laid, v))
                .join(' ');
            snippets[key] = snippet(text, 120);
        } catch {
            // Not on the device and offline: let a later visit try again.
            delete snippets[key];
        }
    }

    watch(passages, (list) => list.forEach(load), { immediate: true });

    return snippets;
}
