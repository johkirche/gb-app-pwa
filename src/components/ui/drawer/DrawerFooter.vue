<template>
    <div :class="cn('mt-auto flex flex-col gap-2 p-4', props.class)">
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
