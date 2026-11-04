<template>
    <!-- Sized by whoever places it, in rem like the type beside it: the symbol
         has to grow with Größe as the name next to it does. -->
    <span
        class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-display font-semibold leading-none text-accent-foreground"
        aria-hidden="true"
    >
        <!-- The roundel is a picture, not markup: an <img> draws an SVG
             without running anything that could be in it. -->
        <img v-if="src" :src="src" alt="" class="size-full object-cover" draggable="false" />
        <template v-else-if="initials">{{ initials }}</template>
        <User v-else class="size-[45%]" />
    </span>
</template>

<script setup lang="ts">
import { User } from 'lucide-vue-next';

defineProps<{
    /** The chosen symbol, as an image source; without one, the initials. */
    src?: string | null;
    initials?: string;
}>();
</script>
