<template>
    <SelectValue v-bind="forwardedProps" :class="cn('truncate', props.class)">
        <slot />
    </SelectValue>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { SelectValue, type SelectValueProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SelectValueProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
