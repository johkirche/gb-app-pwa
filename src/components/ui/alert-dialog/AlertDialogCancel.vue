<template>
    <AlertDialogCancel
        v-bind="forwardedProps"
        :class="cn(buttonVariants({ variant: 'outline' }), props.class)"
    >
        <slot />
    </AlertDialogCancel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { AlertDialogCancel, type AlertDialogCancelProps, useForwardProps } from 'reka-ui';

import { buttonVariants } from '@/components/ui/button';

import { cn } from '@/lib/utils';

interface Props extends AlertDialogCancelProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
