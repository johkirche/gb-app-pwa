<template>
    <div class="notation-col mb-6">
        <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted p-8 text-center"
        >
            <Spinner />
            <p class="text-sm text-muted-foreground">Notenbild wird geladen...</p>
        </div>

        <!-- Vector Notenbild, inlined so the engraving takes the theme's ink -->
        <!-- eslint-disable-next-line vue/no-v-html -- sanitizeNotationSvg strips the markup to drawing primitives -->
        <div
            v-else-if="svgMarkup"
            class="noten-svg overflow-x-auto text-foreground"
            role="img"
            aria-label="Notenbild"
            v-html="svgMarkup"
        ></div>

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
import { Image as ImageIcon } from 'lucide-vue-next';

import { Spinner } from '@/components/ui/spinner';

defineProps<{
    /** Sanitised markup of the vector Notenbild (`notentext_svg`) */
    svgMarkup: string | null;
    /** Raster fallback (`melodieId.noten`) for songs without a synced SVG */
    imageUrl: string | null;
    isLoading: boolean;
}>();
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
