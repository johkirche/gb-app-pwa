<template>
    <DropdownMenuLabel
        v-bind="delegatedProps"
        :class="cn('label-micro px-2 py-1.5 text-muted-foreground', props.class)"
    >
        <slot />
    </DropdownMenuLabel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { DropdownMenuLabel, type DropdownMenuLabelProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends DropdownMenuLabelProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});
</script>
