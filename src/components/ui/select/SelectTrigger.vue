<template>
    <SelectTrigger
        v-bind="forwardedProps"
        :class="
            cn(
                'flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-input bg-transparent px-3 text-sm text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:truncate',
                props.class,
            )
        "
    >
        <slot />
        <SelectIcon as-child>
            <ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </SelectIcon>
    </SelectTrigger>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ChevronDown } from 'lucide-vue-next';
import { SelectIcon, SelectTrigger, type SelectTriggerProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SelectTriggerProps {
    class?: string;
}

const props = defineProps<Props>();

const delegatedProps = computed(() => {
    const { class: _, ...delegated } = props;
    return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>
