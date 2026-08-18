<template>
    <SelectScrollUpButton
        v-bind="forwardedProps"
        :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
    >
        <slot>
            <ChevronUp class="size-4" aria-hidden="true" />
        </slot>
    </SelectScrollUpButton>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ChevronUp } from 'lucide-vue-next';
import { SelectScrollUpButton, type SelectScrollUpButtonProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SelectScrollUpButtonProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
