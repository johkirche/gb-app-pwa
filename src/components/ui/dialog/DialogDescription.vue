<template>
    <DialogDescription
        v-bind="forwardedProps"
        :class="cn('text-sm text-muted-foreground', props.class)"
    >
        <slot />
    </DialogDescription>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { DialogDescription, type DialogDescriptionProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends DialogDescriptionProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
