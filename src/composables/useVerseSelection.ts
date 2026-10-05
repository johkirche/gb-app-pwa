import { computed, ref, shallowRef } from 'vue';

import type { ChapterRef } from '@/utils/bibel';
import type { LaidBlock } from '@/utils/bibelLayout';
import { toggleVerse } from '@/utils/bibelVerses';

/**
 * The verses the reader has picked out of the chapter on screen, shared by
 * the text (which is tapped and shows the selection) and the action bar
 * (which acts on it). Only one chapter is read at a time, so the state is
 * one per app rather than one per component.
 *
 * The text attaches its chapter and layout; the bar reads both, so the page
 * between them only has to mount the bar.
 */

const here = ref<ChapterRef | null>(null);
const laid = shallowRef<LaidBlock[]>([]);
const verses = ref<number[]>([]);
/** The verse whose note is open in the editor, if any. */
const noteVerse = ref<number | null>(null);

const selected = computed(() => new Set(verses.value));

/** A new chapter on screen: nothing in it is picked out yet. */
function attach(ref: ChapterRef, layout: LaidBlock[]) {
    here.value = { ...ref };
    laid.value = layout;
    verses.value = [];
    noteVerse.value = null;
}

function detach() {
    here.value = null;
    laid.value = [];
    verses.value = [];
    noteVerse.value = null;
}

function toggle(verse: number) {
    verses.value = toggleVerse(verses.value, verse);
}

function clear() {
    verses.value = [];
}

function isSelected(verse: number): boolean {
    return selected.value.has(verse);
}

function openNote(verse: number) {
    noteVerse.value = verse;
}

function closeNote() {
    noteVerse.value = null;
}

export function useVerseSelection() {
    return {
        here,
        laid,
        verses,
        noteVerse,
        attach,
        detach,
        toggle,
        clear,
        isSelected,
        openNote,
        closeNote,
    };
}
