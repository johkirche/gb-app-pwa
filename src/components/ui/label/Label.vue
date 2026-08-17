<template>
    <Label
        v-bind="forwardedProps"
        :class="
            cn(
                'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                props.class,
            )
        "
    >
        <slot />
    </Label>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Label, type LabelProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends LabelProps {
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    class: undefined,
});

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
