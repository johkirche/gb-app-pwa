<template>
    <!-- The same five notes, at the same size, drawn twice — so the two cards
         differ in exactly the one thing being chosen: whether an enlarged song
         keeps the book's own long systems and is pushed sideways, or is broken
         onto lines that fit the screen. The frame is the screen. -->
    <svg
        class="preview"
        viewBox="0 0 132 84"
        role="img"
        :aria-label="label"
        preserveAspectRatio="xMidYMid meet"
    >
        <rect class="preview-frame" x="1" y="1" width="130" height="82" rx="5" />

        <!-- A nested viewport clips to itself, which is what lets the engraving
             run past the frame the way it runs past the screen. -->
        <svg x="3" y="3" width="126" height="78" viewBox="0 0 126 78">
            <template v-if="mode === 'engraving'">
                <g class="preview-staff">
                    <line
                        v-for="line in 5"
                        :key="line"
                        x1="-10"
                        :y1="staffY(27, line)"
                        x2="136"
                        :y2="staffY(27, line)"
                    />
                </g>
                <g
                    v-for="(x, index) in [4, 36, 68, 100, 132]"
                    :key="`wide-${index}`"
                    class="preview-note"
                >
                    <ellipse
                        :cx="x"
                        :cy="39 + PITCH[index]"
                        rx="4.5"
                        ry="3.4"
                        :transform="`rotate(-20 ${x} ${39 + PITCH[index]})`"
                    />
                    <rect :x="x + 3.2" :y="39 + PITCH[index] - 17" width="1.4" height="17" />
                </g>
            </template>

            <template v-else>
                <g v-for="(top, row) in [8, 46]" :key="`row-${row}`">
                    <g class="preview-staff">
                        <line
                            v-for="line in 5"
                            :key="line"
                            x1="10"
                            :y1="staffY(top, line)"
                            x2="116"
                            :y2="staffY(top, line)"
                        />
                    </g>
                    <g
                        v-for="(x, index) in row === 0 ? [22, 54, 86] : [22, 54]"
                        :key="`note-${row}-${index}`"
                        class="preview-note"
                    >
                        <ellipse
                            :cx="x"
                            :cy="top + 12 + PITCH[row * 3 + index]"
                            rx="4.5"
                            ry="3.4"
                            :transform="`rotate(-20 ${x} ${top + 12 + PITCH[row * 3 + index]})`"
                        />
                        <rect
                            :x="x + 3.2"
                            :y="top + 12 + PITCH[row * 3 + index] - 17"
                            width="1.4"
                            height="17"
                        />
                    </g>
                </g>
            </template>
        </svg>
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { NotationBeyondFit } from '@/db';

const props = defineProps<{ mode: NotationBeyondFit }>();

/** The same phrase either way, as offsets from the middle line */
const PITCH = [3, -3, -6, 0, 3] as const;

/** Five lines a staff space apart, the top one at `top` */
function staffY(top: number, line: number): number {
    return top + (line - 1) * 6;
}

const label = computed(() =>
    props.mode === 'engraving'
        ? 'Vorschau: der gestochene Satz, über den Rand hinaus'
        : 'Vorschau: dieselben Noten auf zwei Zeilen umgebrochen',
);
</script>

<style scoped>
.preview {
    display: block;
    width: 100%;
    height: auto;
    color: var(--foreground);
}

.preview-frame {
    fill: color-mix(in srgb, var(--foreground) 4%, transparent);
    stroke: var(--border);
    stroke-width: 1;
}

.preview-staff line {
    stroke: currentColor;
    stroke-width: 0.8;
    opacity: 0.3;
}

.preview-note {
    fill: currentColor;
}
</style>
