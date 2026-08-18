<template>
    <AlertDialogDescription
        v-bind="forwardedProps"
        :class="cn('text-sm text-muted-foreground', props.class)"
    >
        <slot />
    </AlertDialogDescription>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { AlertDialogDescription, type AlertDialogDescriptionProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends AlertDialogDescriptionProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
