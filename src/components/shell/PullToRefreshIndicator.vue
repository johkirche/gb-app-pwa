<template>
    <!-- Takes up real height at the top of the scroll content, so the list is
         pushed down by exactly what the finger has pulled open. -->
    <div
        class="overflow-hidden"
        :class="isPulling ? '' : 'transition-[height] duration-200 ease-out'"
        :style="{ height: `${distance}px` }"
        aria-hidden="true"
    >
        <div
            class="flex h-full items-center justify-center gap-2 text-[13px] text-muted-foreground"
        >
            <RefreshCw
                class="size-4 shrink-0"
                :class="isRefreshing ? 'animate-spin' : 'transition-transform duration-200'"
                :style="isRefreshing ? undefined : { transform: `rotate(${rotation}deg)` }"
            />
            <span class="truncate">{{ label }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { RefreshCw } from 'lucide-vue-next';

const props = defineProps<{
    /** Current pull height in pixels — 0 hides the row entirely. */
    distance: number;
    isRefreshing: boolean;
    isPulling: boolean;
    isArmed: boolean;
    /** What is happening right now, shown next to the icon while refreshing. */
    statusLabel?: string;
}>();

// The icon turns with the pull and lands on a half turn as it arms
const rotation = computed(() => (props.isArmed ? 180 : Math.min(180, props.distance * 2.5)));

const label = computed(() => {
    if (props.isRefreshing) return props.statusLabel || 'Wird synchronisiert…';
    return props.isArmed ? 'Loslassen zum Aktualisieren' : 'Zum Aktualisieren ziehen';
});
</script>
