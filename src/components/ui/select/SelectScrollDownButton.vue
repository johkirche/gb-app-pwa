<template>
    <SelectScrollDownButton
        v-bind="forwardedProps"
        :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
    >
        <slot>
            <ChevronDown class="size-4" aria-hidden="true" />
        </slot>
    </SelectScrollDownButton>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ChevronDown } from 'lucide-vue-next';
import { SelectScrollDownButton, type SelectScrollDownButtonProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SelectScrollDownButtonProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
