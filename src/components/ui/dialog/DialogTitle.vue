<template>
    <DialogTitle
        v-bind="forwardedProps"
        :class="cn('font-display text-xl font-semibold leading-snug', props.class)"
    >
        <slot />
    </DialogTitle>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { DialogTitle, type DialogTitleProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends DialogTitleProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
