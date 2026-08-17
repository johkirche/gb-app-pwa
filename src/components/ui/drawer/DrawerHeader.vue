<template>
    <div :class="cn('grid gap-1.5 p-4 text-center', props.class)">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils';

interface Props {
    class?: string;
}

const props = defineProps<Props>();
</script>
