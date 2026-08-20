<template>
    <div ref="containerRef" class="notation-col mb-6">
        <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted p-8 text-center"
        >
            <Spinner />
            <p class="text-sm text-muted-foreground">Notenbild wird geladen...</p>
        </div>

        <!-- Vector Notenbild, inlined so the engraving takes the theme's ink.
             The scale grows the box out of the column and into the page's free
             width, the same way the MusicXML view grows — one control, one
             behaviour, whichever view is on screen. -->
        <div
            v-else-if="svgMarkup"
            class="flex overflow-x-auto overflow-y-hidden"
            :style="scrollBoxStyle"
        >
            <!-- eslint-disable-next-line vue/no-v-html -- sanitizeNotationSvg strips the markup to drawing primitives -->
            <div
                class="noten-svg shrink-0 text-foreground [&_svg]:h-auto [&_svg]:w-full"
                :style="canvasStyle"
                role="img"
                aria-label="Notenbild"
                v-html="svgMarkup"
            ></div>
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
import { computed, ref } from 'vue';

import { Image as ImageIcon } from 'lucide-vue-next';

import { useNotationScale } from '@/composables/useNotationScale';

import { Spinner } from '@/components/ui/spinner';

const props = defineProps<{
    /** Sanitised markup of the vector Notenbild (`notentext_svg`) */
    svgMarkup: string | null;
    /** Raster fallback (`melodieId.noten`) for songs without a synced SVG */
    imageUrl: string | null;
    isLoading: boolean;
    /** The page's one size control */
    scale?: number;
}>();

const containerRef = ref<HTMLElement | null>(null);
const { scrollBoxStyle, canvasStyle } = useNotationScale(
    containerRef,
    computed(() => props.scale ?? 1),
);
</script>

<style scoped>
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
</style>
