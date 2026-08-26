<template>
    <div ref="bandRef" class="playhead" :style="bandStyle" aria-hidden="true"></div>
    <div
        ref="lineRef"
        class="playhead-line"
        :style="{ top: `${box.top}px`, height: `${box.height}px` }"
        aria-hidden="true"
    ></div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { PlayheadBox } from './notationPlayhead';

const props = defineProps<{ box: PlayheadBox }>();

const bandRef = ref<HTMLElement | null>(null);
const lineRef = ref<HTMLElement | null>(null);

const bandStyle = computed(() => ({
    left: `${props.box.left}px`,
    top: `${props.box.top}px`,
    width: `${props.box.width}px`,
    height: `${props.box.height}px`,
    transitionDuration: props.box.animate ? '' : '0s',
}));

/**
 * How far into the sounding note the music stands, 0..1.
 *
 * Written straight to the element rather than through a binding: it changes
 * every frame, and nothing else about the page does.
 */
function sweep(progress: number) {
    const line = lineRef.value;
    if (!line) return;
    const { from, to } = props.box;
    line.style.transform = `translateX(${from + Math.min(1, Math.max(0, progress)) * (to - from)}px)`;
}

/** Where the beat should be brought to. Smooth either way: this only ever runs
 *  while a song is playing, and a jump there would read as a glitch. */
export interface FollowTo {
    block: 'nearest' | 'center';
    inline: 'nearest' | 'center';
}

/** Bring the beat into view — the caller decides when following is wanted. */
function bringIntoView(to: FollowTo) {
    bandRef.value?.scrollIntoView({ behavior: 'smooth', ...to });
}

// A band that has just moved to a new note starts its line at that note, not
// wherever the last frame left it.
watch(
    () => props.box,
    () => sweep(0),
);

defineExpose({ sweep, bringIntoView });
</script>

<style scoped>
/* The beat being sounded, and the line running through it. Both sit behind the
   engraving — the layer around them is the stacking context, so they reach no
   further back than that — which keeps the notes the darkest thing on the staff. */
.playhead,
.playhead-line {
    position: absolute;
    z-index: -1;
    pointer-events: none;
}

.playhead {
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    transition-property: left, top, width, height;
    transition-duration: 110ms;
    transition-timing-function: ease-out;
}

/* Moved every frame, so it is written straight to the element's transform (see
   sweep) — never through a CSS transition, which would drag it behind the music
   it is meant to be showing. Faded at both ends so it reads as a sweep over the
   staff rather than a rule drawn across it. */
.playhead-line {
    left: 0;
    width: 2px;
    border-radius: 1px;
    background: linear-gradient(
        to bottom,
        transparent,
        color-mix(in srgb, var(--gold) 70%, transparent) 12%,
        color-mix(in srgb, var(--gold) 70%, transparent) 88%,
        transparent
    );
    will-change: transform;
}
</style>
