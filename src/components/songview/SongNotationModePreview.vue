<template>
    <!-- The same three notes drawn twice, so the two cards differ in exactly
         the one thing that is being chosen: whether the melody comes as the
         printed page or as notes the app sets itself. -->
    <svg
        class="preview"
        viewBox="0 0 132 62"
        role="img"
        :aria-label="label"
        preserveAspectRatio="xMidYMid meet"
    >
        <!-- Notenbild: a sheet, dog-eared. It is a picture of the page as the
             book prints it — nothing on it can move. -->
        <g v-if="mode === 'image'" class="preview-sheet">
            <path
                d="M6 2 H114 L130 18 V56 A4 4 0 0 1 126 60 H6 A4 4 0 0 1 2 56 V6 A4 4 0 0 1 6 2 Z"
            />
            <path class="preview-fold" d="M114 2 L130 18 H114 Z" />
        </g>

        <!-- MusicXML: no sheet. These notes are set by the app, so the
             transport's marks can run across them. -->
        <g v-else class="preview-mark">
            <rect class="preview-band" x="52" y="8" width="28" height="46" rx="4" />
            <rect class="preview-playhead" x="65" y="10" width="2" height="42" rx="1" />
        </g>

        <g class="preview-staff">
            <line
                v-for="line in 5"
                :key="line"
                :x1="staffX[0]"
                :y1="staffY(line)"
                :x2="staffX[1]"
                :y2="staffY(line)"
            />
        </g>

        <g
            v-for="(note, index) in NOTES"
            :key="note.syllable"
            class="preview-note"
            :class="{ 'preview-lit': mode === 'xml' && index === 1 }"
        >
            <ellipse
                :cx="note.x"
                :cy="note.y"
                rx="3.8"
                ry="2.9"
                :transform="`rotate(-20 ${note.x} ${note.y})`"
            />
            <rect :x="note.x + 2.7" :y="note.y - 15" width="1.3" height="15" />
            <text :x="note.x" y="55">{{ note.syllable }}</text>
        </g>
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { MelodyDisplayMode } from '@/db';

const props = defineProps<{ mode: MelodyDisplayMode }>();

// The same phrase the playback preview sings, so the two settings read as
// pictures of one song page rather than of two different ones.
const NOTES = [
    { x: 34, y: 35, syllable: 'Lo' },
    { x: 66, y: 30, syllable: 'be' },
    { x: 98, y: 25, syllable: 'singt' },
] as const;

/** Five lines, four spaces of five units, the top one at y = 20 */
function staffY(line: number): number {
    return 15 + line * 5;
}

// The sheet's dog-ear eats into the top right corner, so the staff on it stops
// short of the fold; without a sheet it may run the full width.
const staffX = computed<[number, number]>(() => (props.mode === 'image' ? [12, 112] : [8, 124]));

const label = computed(() =>
    props.mode === 'image'
        ? 'Vorschau: die gedruckte Notenseite als Bild'
        : 'Vorschau: neu gesetzte Noten mit Abspielmarkierung',
);
</script>

<style scoped>
.preview {
    display: block;
    width: 100%;
    height: auto;
    color: var(--foreground);
}

.preview-sheet path {
    fill: color-mix(in srgb, var(--foreground) 5%, transparent);
    stroke: var(--border);
    stroke-width: 1;
}

.preview-fold {
    fill: color-mix(in srgb, var(--foreground) 12%, transparent);
}

.preview-staff line {
    stroke: currentColor;
    stroke-width: 0.8;
    opacity: 0.3;
}

.preview-note {
    fill: currentColor;
}

.preview-note text {
    font-family: var(--font-hymnal);
    font-size: 9px;
    text-anchor: middle;
}

.preview-lit {
    color: var(--gold);
}

.preview-band {
    fill: color-mix(in srgb, var(--gold) 14%, transparent);
}

.preview-playhead {
    fill: color-mix(in srgb, var(--gold) 70%, transparent);
}
</style>
