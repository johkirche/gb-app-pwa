<template>
    <DialogOverlay
        v-bind="forwardedProps"
        :class="
            cn(
                'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
                props.class,
            )
        "
    >
        <slot />
    </DialogOverlay>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { DialogOverlay, type DialogOverlayProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends DialogOverlayProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
