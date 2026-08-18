<template>
    <!-- The drawer form must use vaul's own title so the sheet keeps its
         accessible name; the popover form is named by ResponsivePanel's
         `label` instead (reka overwrites aria-labelledby on trigger-less
         popovers), so a plain heading is enough here. -->
    <DrawerTitle v-if="surface === 'drawer'" :class="cn(titleClass, props.class)">
        <slot />
    </DrawerTitle>
    <h2 v-else :class="cn(titleClass, props.class)">
        <slot />
    </h2>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';

import { DrawerTitle } from '@/components/ui/drawer';

import { cn } from '@/lib/utils';

import { PANEL_CONTEXT } from './context';

interface Props {
    class?: string;
}

const props = defineProps<Props>();

const panel = inject(PANEL_CONTEXT, null);

const surface = computed(() => panel?.surface.value ?? 'drawer');

const titleClass = 'font-display text-lg font-semibold text-foreground';
</script>
