<template>
    <SelectGroup v-bind="delegatedProps" :class="cn('w-full', props.class)">
        <slot />
    </SelectGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { SelectGroup, type SelectGroupProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SelectGroupProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});
</script>
