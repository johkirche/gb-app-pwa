<template>
    <AlertDialogTitle
        v-bind="forwardedProps"
        :class="cn('font-display text-xl font-semibold leading-snug', props.class)"
    >
        <slot />
    </AlertDialogTitle>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { AlertDialogTitle, type AlertDialogTitleProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends AlertDialogTitleProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
