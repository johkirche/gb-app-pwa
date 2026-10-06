<template>
    <!-- One action in the verse bar: an icon over a short word. Exported for
         actions added from outside through the bar's slot, so they sit in the
         row as equals. The bar holds five at most (see verseActions.ts), so
         an equal share always has room for its word. -->
    <button
        type="button"
        class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground"
    >
        <component :is="icon" class="size-5 text-foreground" aria-hidden="true" />
        <span class="max-w-full truncate">{{ label }}</span>
    </button>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
    icon: Component;
    label: string;
}>();
</script>
