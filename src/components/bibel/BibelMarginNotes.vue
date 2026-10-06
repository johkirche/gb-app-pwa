<template>
    <!-- The reader's notes in the margin, each level with its verse, the way
         one writes beside the text in a printed Bible. Left of the column:
         the right is where the verse actions stand. Only on a screen wide
         enough to have a margin; elsewhere the note icon after the verse
         opens them. -->
    <div
        class="pointer-events-none absolute inset-y-0 right-[calc(100%+2rem)] w-56"
        aria-label="Ihre Notizen"
        role="complementary"
    >
        <button
            v-for="note in placed"
            :key="note.verse"
            :ref="(el) => setCard(note.verse, el as HTMLElement | null)"
            type="button"
            class="pointer-events-auto absolute inset-x-0 rounded-md border-l-2 border-gold/60 py-1 pl-3 pr-2 text-left font-sans transition-colors hover:bg-muted"
            :style="{ top: `${note.top}px` }"
            :aria-label="`Notiz zu Vers ${note.verse}: ${note.text}`"
            @click="selection.openNote(note.verse)"
        >
            <span class="label-micro block text-gold" aria-hidden="true">
                Vers {{ note.verse }}
            </span>
            <span
                class="mt-0.5 line-clamp-6 block whitespace-pre-line text-[0.8125rem] leading-snug text-muted-foreground"
                aria-hidden="true"
            >
                {{ note.text }}
            </span>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { useNotizenStore } from '@/stores/notizen';

import { useVerseSelection } from '@/composables/useVerseSelection';

/**
 * Lays the chapter's notes beside the verses they belong to. Measures where
 * each verse starts in the column, then moves a note down where the one
 * above it runs long, so none overlap. Measured again whenever the column
 * changes size — a new text size, headings or footnotes switched on.
 */

const props = defineProps<{
    slug: string;
    chapter: number;
    /** The text column the notes sit beside, positioned relative. */
    column: HTMLElement | null;
}>();

const GAP = 8;

const notizen = useNotizenStore();
const selection = useVerseSelection();

const notes = computed(() =>
    notizen.sorted
        .filter((n) => n.slug === props.slug && n.chapter === props.chapter)
        .sort((a, b) => a.verse - b.verse),
);

const placed = ref<{ verse: number; text: string; top: number }[]>([]);
const cards = new Map<number, HTMLElement>();

function setCard(verse: number, el: HTMLElement | null) {
    if (el) cards.set(verse, el);
    else cards.delete(verse);
}

/** Where the verse starts, from the top of the column. */
function verseTop(column: HTMLElement, verse: number): number | null {
    // Its first words, not its number: the numbers can be switched off.
    const el = column.querySelector<HTMLElement>(`[data-verse="${verse}"]`);
    if (!el) return null;
    return el.getBoundingClientRect().top - column.getBoundingClientRect().top;
}

async function layout() {
    const column = props.column;
    if (!column) {
        placed.value = [];
        return;
    }
    // First where each note would like to be, then — once drawn and its
    // height known — pushed below the one above where they would meet.
    placed.value = notes.value.flatMap((n) => {
        const top = verseTop(column, n.verse);
        return top === null ? [] : [{ verse: n.verse, text: n.text, top }];
    });
    await nextTick();
    let floor = -Infinity;
    for (const note of placed.value) {
        note.top = Math.max(note.top, floor);
        floor = note.top + (cards.get(note.verse)?.offsetHeight ?? 0) + GAP;
    }
}

let observer: ResizeObserver | null = null;

watch(
    () => props.column,
    (column) => {
        observer?.disconnect();
        if (column && typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => void layout());
            observer.observe(column);
        }
        void layout();
    },
    { immediate: true },
);
watch(notes, () => void layout(), { deep: true });

onBeforeUnmount(() => observer?.disconnect());
</script>
