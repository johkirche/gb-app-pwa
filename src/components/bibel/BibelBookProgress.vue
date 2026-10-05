<template>
    <!-- A small ring beside a book in the list: how much of it is read. Left
         out until the first chapter, so the list stays quiet for a reader who
         does not keep track. -->
    <span
        v-if="progress.read > 0"
        class="relative inline-flex size-5 shrink-0"
        role="img"
        :aria-label="label"
        :title="label"
    >
        <svg viewBox="0 0 20 20" class="size-5 -rotate-90" aria-hidden="true">
            <circle cx="10" cy="10" :r="R" fill="none" stroke-width="2.5" class="stroke-muted" />
            <circle
                cx="10"
                cy="10"
                :r="R"
                fill="none"
                stroke-width="2.5"
                stroke-linecap="round"
                class="stroke-gold"
                :stroke-dasharray="`${filled} ${CIRCUMFERENCE}`"
            />
        </svg>
        <Check
            v-if="complete"
            class="absolute inset-0 m-auto size-3 text-gold"
            stroke-width="3"
            aria-hidden="true"
        />
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Check } from 'lucide-vue-next';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';

const props = defineProps<{ slug: string }>();

const R = 8;
const CIRCUMFERENCE = 2 * Math.PI * R;

const fortschritt = useBibelFortschrittStore();
const progress = computed(() => fortschritt.bookProgress(props.slug));
const complete = computed(() => progress.value.read >= progress.value.total);
const filled = computed(() =>
    progress.value.total ? (progress.value.read / progress.value.total) * CIRCUMFERENCE : 0,
);
const label = computed(() =>
    complete.value
        ? 'Ganz gelesen'
        : `${progress.value.read} von ${progress.value.total} Kapiteln gelesen`,
);
</script>
