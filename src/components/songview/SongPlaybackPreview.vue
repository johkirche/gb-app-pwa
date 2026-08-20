<template>
    <!-- A staff small enough to sit in a settings row, showing exactly what the
         two switches below it do: the band and its line sweep from note to
         note, and the note being passed takes the flourish colour. Both halves
         answer to the same switches the real engraving does, so the preview is
         never a picture of a setting that is off. -->
    <svg
        class="preview"
        viewBox="0 0 132 54"
        role="img"
        :aria-label="description"
        preserveAspectRatio="xMidYMid meet"
    >
        <g v-if="showPlayhead" class="preview-mark">
            <rect class="preview-band" x="14" y="4" width="36" height="46" rx="4" />
            <rect class="preview-line" x="25" y="6" width="2" height="42" rx="1" />
        </g>

        <g class="preview-staff">
            <line
                v-for="line in 5"
                :key="line"
                x1="4"
                :y1="staffY(line)"
                x2="128"
                :y2="staffY(line)"
            />
        </g>

        <g
            v-for="(note, index) in NOTES"
            :key="note.syllable"
            :class="['preview-note', `preview-note-${index}`, { 'preview-lit': highlightNotes }]"
        >
            <ellipse
                :cx="note.x"
                :cy="note.y"
                rx="3.8"
                ry="2.9"
                :transform="`rotate(-20 ${note.x} ${note.y})`"
            />
            <rect :x="note.x + 2.7" :y="note.y - 15" width="1.3" height="15" />
            <text :x="note.x" y="49">{{ note.syllable }}</text>
        </g>
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    highlightNotes: boolean;
    showPlayhead: boolean;
}>();

// Three notes is the fewest that reads as a phrase rather than a symbol, and
// the fewest the band can visibly step across.
const NOTES = [
    { x: 32, y: 30, syllable: 'Lo' },
    { x: 68, y: 25, syllable: 'be' },
    { x: 104, y: 20, syllable: 'singt' },
] as const;

/** Five lines, four spaces of five units, the top one at y = 15 */
function staffY(line: number): number {
    return 10 + line * 5;
}

const description = computed(() => {
    const shown = [
        props.highlightNotes ? 'hervorgehobenen Noten' : null,
        props.showPlayhead ? 'Abspielbalken' : null,
    ].filter(Boolean);
    return shown.length
        ? `Vorschau der Wiedergabe mit ${shown.join(' und ')}`
        : 'Vorschau der Wiedergabe ohne Markierungen';
});
</script>

<style scoped>
.preview {
    display: block;
    width: 100%;
    height: auto;
    color: var(--foreground);
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

/* Lit is the middle note by default — the position the band rests at when it
   is not sweeping, so a still preview still shows the two working together. */
.preview-note-1.preview-lit {
    color: var(--gold);
}

.preview-band {
    fill: color-mix(in srgb, var(--gold) 14%, transparent);
    transform: translateX(36px);
}

.preview-line {
    fill: color-mix(in srgb, var(--gold) 70%, transparent);
    transform: translateX(36px);
}

/* The sweep. Left to a still picture the band and the line are just two marks;
   moving, they say what they are. One note per 1.2s — the tempo the transport
   starts at. */
@media (prefers-reduced-motion: no-preference) {
    .preview-line {
        animation: preview-sweep 3.6s linear infinite;
    }

    .preview-band {
        /* jump-none lands on 0, 36 and 72 — the three notes exactly. */
        animation: preview-sweep 3.6s steps(3, jump-none) infinite;
    }

    .preview-note-0.preview-lit,
    .preview-note-1.preview-lit,
    .preview-note-2.preview-lit {
        animation: preview-lit 3.6s steps(1, end) infinite;
    }

    /* Negative delays put each note's lit third under the band as it arrives. */
    .preview-note-0.preview-lit {
        animation-delay: 0s;
    }

    .preview-note-1.preview-lit {
        animation-delay: -2.4s;
    }

    .preview-note-2.preview-lit {
        animation-delay: -1.2s;
    }
}

@keyframes preview-sweep {
    from {
        transform: translateX(0);
    }
    to {
        transform: translateX(72px);
    }
}

@keyframes preview-lit {
    0% {
        color: var(--gold);
    }
    33.34% {
        color: var(--foreground);
    }
}
</style>
