<template>
    <h3 :class="cn('font-display text-lg font-semibold leading-tight', props.class)">
        <slot />
    </h3>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
    class?: string;
}

const props = defineProps<Props>();
</script>
