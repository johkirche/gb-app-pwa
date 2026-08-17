<template>
    <SelectLabel
        v-bind="delegatedProps"
        :class="cn('label-micro px-2 py-1.5 text-muted-foreground', props.class)"
    >
        <slot />
    </SelectLabel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { SelectLabel, type SelectLabelProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SelectLabelProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});
</script>
