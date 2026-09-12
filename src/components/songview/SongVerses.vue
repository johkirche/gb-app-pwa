<template>
    <!-- The verses sit in the book's measure (see .verse-col), not in the full
         page column: a hymn verse set across a desktop page reads as a wall of
         prose rather than as a hymnal page. -->
    <div ref="listRef" class="verse-col mb-8">
        <div ref="rowsRef" class="flex flex-col items-stretch">
            <template v-for="(strophe, idx) in strophes" :key="idx">
                <div
                    v-if="!(skipFirst && idx === 0)"
                    class="verse-row mb-6 flex items-baseline"
                    :class="{ 'verse-unsung': !isSung(sungVerses, idx + 1) }"
                >
                    <span class="verse-number number-display shrink-0">{{ idx + 1 }}.</span>
                    <div class="verse-body flex min-w-0 flex-1 flex-col">
                        <!-- The dimming is the whole signal on screen; screen
                             readers get it said. -->
                        <span v-if="!isSung(sungVerses, idx + 1)" class="sr-only">
                            Wird in diesem Gottesdienst nicht gesungen:
                        </span>
                        <!-- text-balance evens the lines out so a verse does
                             not trail off into a single orphaned word -->
                        <p
                            class="verse-text m-0 text-balance whitespace-pre-line font-hymnal text-foreground"
                        >
                            {{ verseText(strophe) }}
                        </p>
                        <p
                            v-if="strophe.anmerkung"
                            class="verse-note mt-1 italic text-muted-foreground"
                        >
                            {{ strophe.anmerkung }}
                        </p>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { isVerseSung as isSung } from '@/services/servicePlans';
import { type VerseLike, verseText } from '@/utils/verses';

const props = defineProps<{
    strophes: VerseLike[];
    /**
     * Leave out verse 1 because the notation on screen already carries it
     * under its notes. The remaining verses keep their real numbers — the
     * list is numbered from the index, not from its own position.
     */
    skipFirst?: boolean;
    /**
     * The verses this service actually sings, as 1-based numbers. The others
     * stay on the page — the reader still has to be able to read past them —
     * but stand back, so nobody sings a verse the congregation skips.
     * `undefined` or `null` means the whole hymn, which is the normal case.
     */
    sungVerses?: number[] | null;
    /**
     * The page's scale, passed only so the centring can re-measure when it
     * changes. The size itself still travels as CSS variables — this component
     * reads none of it — but a change reflows every line, and the block's new
     * width has to be measured again once it has.
     */
    scale?: number;
}>();

// --- Centring the verses under the notation --------------------------------
//
// text-balance leaves every line well short of the column, so the block sits
// in the column's left half and no longer reads as centred beneath the notes.
// CSS cannot fix this: a balanced paragraph is still laid out at its full
// width, and `width: fit-content` resolves to max-content — the unwrapped
// line — so it shrink-wraps to nothing useful. The block's real width is only
// knowable after layout, by measuring it.
//
// The whole list is shifted once, by half the slack left over from its widest
// line anywhere. Centring each verse on its own width instead would leave the
// numbers standing at as many different margins as there are verses — they are
// a column of their own and have to read as one. The shift is a transform, not
// a margin: it moves no boxes, cannot widen the page into a horizontal scroll,
// and — because it leaves the paragraphs' layout width alone — cannot feed
// back into the balancing it is centring.

const listRef = ref<HTMLElement | null>(null);
const rowsRef = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;

/** Width of the longest line box the element actually rendered */
function widestLine(el: Element): number {
    const range = document.createRange();
    range.selectNodeContents(el);
    let widest = 0;
    for (const rect of range.getClientRects()) {
        if (rect.width > widest) widest = rect.width;
    }
    return widest;
}

function centreRows() {
    const list = listRef.value;
    const rows = rowsRef.value;
    if (!list || !rows) return;
    const body = list.querySelector<HTMLElement>('.verse-body');
    if (!body) return;
    // Slack is measured on the text's own box, which is exactly the row minus
    // the hanging number: shifting by half of it centres numbers and text
    // together, so each number stays beside the verse it belongs to and all of
    // them stay in line with each other.
    const available = body.getBoundingClientRect().width;
    let widest = 0;
    for (const p of list.querySelectorAll('.verse-text, .verse-note')) {
        widest = Math.max(widest, widestLine(p));
    }
    const slack = available - widest;
    // Rounded: a fractional translate would blur the type it centres.
    rows.style.transform = slack > 1 ? `translateX(${Math.round(slack / 2)}px)` : '';
}

// Re-measure whenever the rendered text changes shape. The observer covers
// what the component cannot see coming — the column resizing under a viewport
// change — while a Textgröße change is watched directly rather than left to
// it: the observer is paused while the tab is in the background, so a scale
// changed there would otherwise be centred against the old layout on return.
// The transform itself changes no observed box, so this cannot loop.
function observeParagraphs() {
    const list = listRef.value;
    if (!list || !observer) return;
    observer.disconnect();
    for (const p of list.querySelectorAll('.verse-text, .verse-note')) {
        observer.observe(p);
    }
}

onMounted(() => {
    observer = new ResizeObserver(() => centreRows());
    observeParagraphs();
    centreRows();
    // The display face loads after first paint and re-flows every line with it.
    document.fonts?.ready.then(() => centreRows());
});

watch(
    () => [props.strophes, props.skipFirst, props.scale],
    async () => {
        await nextTick();
        observeParagraphs();
        centreRows();
    },
);

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
});
</script>

<style scoped>
/* Live text-size contract: the parent (.song-content.text-size-*) provides
   --verse-font-size / --verse-line-height so the popover's Textgröße setting
   updates the verses without re-render. */
/* The verses are set in the hymnal's own face (font-hymnal in the template),
   the one the Notenbild carries baked into its outlines: on the printed page
   the lyrics under the notes and the verses beside them are one typeface at one
   size, and the page only reads as a hymnal page when they still are. */
.verse-number,
.verse-text {
    font-size: var(--verse-font-size, 1.125rem);
    line-height: var(--verse-line-height, 1.35);
}

/* The number column and the gap beside it are stated in verse type too, so the
   whole row scales with Textgröße. Left at a fixed 1.5rem/0.75rem they would
   take a smaller share of the wider column at a larger size, the text measure
   would drift with it, and the lines this column exists to hold still would
   re-wrap after all. The multipliers are today's rem values over the default
   1.125rem, so nothing moves at the default Textgröße. */
.verse-row {
    gap: calc(var(--verse-font-size, 1.125rem) * 0.6667);
}

.verse-number {
    min-width: calc(var(--verse-font-size, 1.125rem) * 1.3333);
}

/* A verse this service does not sing. It stays legible — somebody will read
   ahead, and a verse rendered unreadable is a verse the page has hidden — but
   it recedes far enough that the sung ones are what the eye lands on. */
.verse-unsung {
    opacity: 0.4;
}

/* Per-verse note (anmerkung): slightly smaller than the verse itself */
.verse-note {
    font-family: var(--font-hymnal, sans-serif);
    font-size: calc(var(--verse-font-size, 1.125rem) * 0.85);
    line-height: var(--verse-line-height, 1.35);
}
</style>
