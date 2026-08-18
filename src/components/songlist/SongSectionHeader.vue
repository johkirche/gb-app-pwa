<template>
    <!-- Editorial section divider: gold micro-label + trailing hairline. Sticks to the
         top of the scroll container (the toolbar lives outside it after the migration).
         The id `section-<key>` and the class `section-header` are load-bearing contracts:
         SongsListPage's scroll routines query both. -->
    <div
        :id="sectionId"
        class="section-header sticky top-0 z-10 flex items-center gap-3 bg-background px-2 pb-2 pt-4"
    >
        <span class="label-micro min-w-0 truncate text-gold">{{ label }}</span>
        <span class="h-px min-w-6 flex-1 bg-border" aria-hidden="true"></span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    sectionKey: string;
    label: string;
}>();

const sectionId = computed(() => `section-${props.sectionKey}`);
</script>
