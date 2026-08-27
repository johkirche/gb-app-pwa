<template>
    <div>
        <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted p-8 text-center"
        >
            <Spinner />
            <p class="text-sm text-muted-foreground">Notenbild wird geladen...</p>
        </div>

        <!-- Vector Notenbild, inlined so the engraving takes the theme's ink.
             The scale grows the box out of the column and into the page's free
             width; only once even that is used up does this scroll. -->
        <div
            v-else-if="svgMarkup"
            ref="scrollRef"
            class="flex overflow-x-auto overflow-y-hidden"
            :style="scrollBoxStyle"
        >
            <!-- The layer carries the drawn width so the band can be measured
                 against it, and it is the stacking context the band sits inside
                 — behind the engraving, no further back than that. -->
            <div ref="layerRef" class="notation-layer relative shrink-0" :style="canvasStyle">
                <!-- eslint-disable-next-line vue/no-v-html -- sanitizeNotationSvg strips the markup to drawing primitives -->
                <div
                    ref="hostRef"
                    class="noten-svg text-foreground [&_svg]:h-auto [&_svg]:w-full"
                    role="img"
                    aria-label="Notenbild"
                    v-html="svgMarkup"
                ></div>
                <NotationPlayhead v-if="playhead" ref="playheadRef" :box="playhead" />
            </div>
        </div>

        <!-- Raster fallback for songs cached before notentext_svg was synced.
             Kept on a white sheet: those scans are black on transparent and
             would vanish on the dark theme. -->
        <img
            v-else-if="imageUrl"
            :src="imageUrl"
            alt="Notenbild"
            class="block h-auto w-full rounded-lg bg-white p-2"
        />

        <div
            v-else
            class="flex items-center justify-center gap-2 rounded-lg bg-muted p-6 italic text-muted-foreground"
        >
            <ImageIcon class="size-5 shrink-0" aria-hidden="true" />
            <span>Notenbild nicht verfügbar</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Image as ImageIcon } from 'lucide-vue-next';

import NotationPlayhead from '@/components/songview/NotationPlayhead.vue';
import { Spinner } from '@/components/ui/spinner';

import {
    type NotationMark,
    notationMapKind,
    noteHead,
    noteParts,
    syllables,
    systemOf,
    systemRect,
    verseForPass,
    versesAtNote,
} from '@/utils/notationMap';

import { type PlayheadBox, playheadBox } from './notationPlayhead';

const props = defineProps<{
    /** Sanitised markup of the vector Notenbild (`notentext_svg`) */
    svgMarkup: string | null;
    /** Raster fallback (`melodieId.noten`) for songs without a synced SVG */
    imageUrl: string | null;
    isLoading: boolean;
    /** Widths measured once for the whole melody column — see useNotationScale */
    scrollBoxStyle: Record<string, string>;
    canvasStyle: Record<string, string>;
    /** Colour the sounding note and the syllable sung on it */
    highlightNotes: boolean;
    /** Show the band and the line that sweep the staff */
    showPlayhead: boolean;
}>();

const scrollRef = ref<HTMLElement | null>(null);
const layerRef = ref<HTMLElement | null>(null);
const hostRef = ref<HTMLElement | null>(null);
const playheadRef = ref<InstanceType<typeof NotationPlayhead> | null>(null);

const ACTIVE_CLASS = 'gb-play-active';

const playhead = ref<PlayheadBox | null>(null);

let litNotes: Element[] = [];
let litSyllables: Element[] = [];
/** Which system the mark last stood in — the band only slides within one */
let litSystem: string | null = null;
/** Kept so a resize, or a setting toggled mid-song, can put the mark back */
let standing: NotationMark | null = null;

function clearInk() {
    for (const element of litNotes) element.classList.remove(ACTIVE_CLASS);
    for (const element of litSyllables) element.classList.remove(ACTIVE_CLASS);
    litNotes = [];
    litSyllables = [];
}

function clearMark() {
    clearInk();
    litSystem = null;
    standing = null;
    playhead.value = null;
}

/**
 * Light the note being sung and the words under it.
 *
 * The verse is chosen from the numbers written *at this note*, in the order
 * they are written: a repeat sings the same noteheads a second time, and it is
 * the pass — not the number "2" — that says which line is being sung. Lied 8 is
 * the case that proves it.
 */
function mark(next: NotationMark | null) {
    const host = hostRef.value;
    // How far this engraving can be followed is asked of the document itself,
    // never of a list of song ids: gb-scripts writes each key only where it
    // could be checked against the MusicXML, so twelve songs carry no note map
    // and a handful carry notes without syllables. Where there is no map, the
    // Notenbild is simply shown and nothing runs along it. Asked at every mark
    // rather than remembered, because the answer arrives with the markup and
    // the element that holds it, and those two do not land on the same tick.
    if (!host || !props.svgMarkup || notationMapKind(host) === 'none') return;
    if (!next) {
        clearMark();
        return;
    }

    const head = noteHead(host, next.note);
    // A note the engraving does not carry — the map ends before the music does.
    // Leaving the last mark standing beats blanking the page mid-song.
    if (!head) return;

    standing = next;

    if (!props.highlightNotes) {
        clearInk();
    } else {
        // The whole note, not the head alone: the engraver draws it from a head,
        // a stem and whatever flag or dot it carries, and all of them answer to
        // its ordinal.
        const parts = noteParts(host, next.note);
        for (const element of litNotes) element.classList.remove(ACTIVE_CLASS);
        litNotes = parts;
        for (const element of parts) element.classList.add(ACTIVE_CLASS);

        const verse = verseForPass(versesAtNote(host, next.note), next.pass);
        const sung = syllables(host, next.note, verse);
        // Nothing written at this note means a syllable is being held across it
        // — 4.6% of all noteheads. The word already lit stays lit; clearing it
        // would blank the text for the length of the melisma.
        if (sung.length) {
            for (const element of litSyllables) element.classList.remove(ACTIVE_CLASS);
            litSyllables = sung;
            for (const element of sung) element.classList.add(ACTIVE_CLASS);
        }
    }

    updateBand(host, head, next);
}

function updateBand(host: Element, head: SVGGraphicsElement, at: NotationMark) {
    const layer = layerRef.value;
    const system = systemOf(head);
    const rect = systemRect(host, system);
    if (!layer || !rect || !props.showPlayhead) {
        playhead.value = null;
        litSystem = system;
        return;
    }

    // The successor comes from the playback's own reckoning, never from
    // document order: over a repeat's jump the next note drawn is not the next
    // note sung. One on another system does not bound this beat either — there
    // the beat runs to the end of its own system.
    const successor = at.next === null ? null : noteHead(host, at.next);
    const bounded = successor && systemOf(successor) === system ? successor : null;

    const sameSystem = system !== null && system === litSystem;
    playhead.value = playheadBox(
        layer.getBoundingClientRect(),
        rect.getBoundingClientRect(),
        [head.getBoundingClientRect()],
        bounded ? bounded.getBoundingClientRect() : null,
        sameSystem,
    );
    litSystem = system;

    if (at.follow) nextTick(() => follow(!sameSystem));
}

// Keep the beat in view. Vertically only when it reaches a new system, so
// following never fights a reader scrolling the page themselves; sideways
// whenever the engraving is wider than the box showing it, because there the
// music leaves the screen within a single system.
function follow(systemChanged: boolean) {
    const box = scrollRef.value;
    const sideways = !!box && box.scrollWidth > box.clientWidth + 1;
    if (!systemChanged && !sideways) return;
    playheadRef.value?.bringIntoView({
        block: 'nearest',
        inline: sideways ? 'center' : 'nearest',
    });
}

/** How far into the sounding note the music stands, 0..1 */
function sweep(progress: number) {
    playheadRef.value?.sweep(progress);
}

/** Put the mark back where it stands — after a resize, or a setting toggled. */
function refresh() {
    if (!standing) return;
    mark({ ...standing, follow: false });
}

// Every element the mark hung on has just been replaced.
watch(
    () => props.svgMarkup,
    () => {
        litNotes = [];
        litSyllables = [];
        litSystem = null;
        standing = null;
        playhead.value = null;
    },
);

watch(
    () => `${props.highlightNotes}|${props.showPlayhead}`,
    () => refresh(),
);

// Watched rather than observed once on mount, for the same reason: the layer
// only exists from the moment the engraving does.
const layerObserver = new ResizeObserver(() => refresh());
watch(
    layerRef,
    (layer, previous) => {
        if (previous) layerObserver.unobserve(previous);
        if (layer) layerObserver.observe(layer);
    },
    { immediate: true, flush: 'post' },
);

onBeforeUnmount(() => layerObserver.disconnect());

defineExpose({ mark, clearMark, sweep, refresh });
</script>

<style scoped>
/* Own stacking context, so the band behind the engraving stops there instead of
   falling through to the page's own background and disappearing. */
.notation-layer {
    isolation: isolate;
}

/* The baked export hard-codes black on the staff lines, stems and barlines it
   draws as stroked paths — a stylesheet rule outranks that presentation
   attribute. Those same paths carry `fill="none"`, which must survive, so only
   real colours are redirected to the theme ink. The note heads and the outlined
   verse-1 lyrics have no paint of their own and inherit `fill: currentColor`
   from the root element (set in sanitizeNotationSvg). */
.noten-svg :deep([stroke]:not([stroke='none'])) {
    stroke: currentColor;
}

.noten-svg :deep([fill]:not([fill='none'])) {
    fill: currentColor;
}

/* The sounding note and the syllable sung on it, in the flourish colour. Both
   are named through their map attribute as well as the class: the ink rule
   above is a two-part selector too, and an even fight would be settled by
   source order rather than by what the rule means. */
.noten-svg :deep([data-note].gb-play-active:not([data-part='stem'])),
.noten-svg :deep([data-lyric].gb-play-active) {
    fill: var(--gold);
    transition: fill 90ms linear;
}

/* The stem is the one piece of a note that is drawn rather than placed: a
   stroked line carrying `fill="none"`, which the fill above cannot reach. It is
   held out of that rule instead of merely added here, because a colour set on a
   `<use>` reaches the glyph in `<defs>` — and a stroke there would be laid on in
   the glyph's own coordinates, some fifteen times scaled up, thickening every
   lit notehead into a blot. */
.noten-svg :deep([data-part='stem'].gb-play-active) {
    stroke: var(--gold);
    transition: stroke 90ms linear;
}
</style>
