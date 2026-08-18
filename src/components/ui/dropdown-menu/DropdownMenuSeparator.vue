<template>
    <DropdownMenuSeparator
        v-bind="delegatedProps"
        :class="cn('-mx-1 my-1 h-px bg-border', props.class)"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { DropdownMenuSeparator, type DropdownMenuSeparatorProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends DropdownMenuSeparatorProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});
</script>
