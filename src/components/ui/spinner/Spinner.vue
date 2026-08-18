<template>
    <span
        role="status"
        :class="cn('inline-flex items-center justify-center text-muted-foreground', props.class)"
    >
        <LoaderCircle :class="spinnerVariants({ size })" aria-hidden="true" />
        <span class="sr-only">{{ label }}</span>
    </span>
</template>

<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next';

import { cn } from '@/lib/utils';

import { type SpinnerVariants, spinnerVariants } from './index';

interface Props {
    size?: SpinnerVariants['size'];
    label?: string;
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    size: 'default',
    label: 'Lädt…',
    class: undefined,
});
</script>
