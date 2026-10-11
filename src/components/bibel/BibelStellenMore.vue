<template>
    <!-- Under a list the Bibel tab cuts short: how many more there are, and
         the way to all of them. Absent while the list is shown whole. -->
    <RouterLink
        v-if="count > shown"
        :to="to"
        class="flex items-center justify-between gap-2 rounded-sm border-t border-border px-2 py-2.5 text-[0.9375rem] font-medium text-primary transition-colors hover:bg-muted"
    >
        <span class="min-w-0">Alle {{ count }} anzeigen</span>
        <ChevronRight class="size-[1.125rem] shrink-0" aria-hidden="true" />
    </RouterLink>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

defineProps<{
    /** How many there are. */
    count: number;
    /** How many the list above shows. */
    shown: number;
    to: string;
}>();
</script>
