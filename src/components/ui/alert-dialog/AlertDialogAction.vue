<template>
    <AlertDialogAction v-bind="forwardedProps" :class="cn(buttonVariants(), props.class)">
        <slot />
    </AlertDialogAction>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { AlertDialogAction, type AlertDialogActionProps, useForwardProps } from 'reka-ui';

import { buttonVariants } from '@/components/ui/button';

import { cn } from '@/lib/utils';

interface Props extends AlertDialogActionProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
