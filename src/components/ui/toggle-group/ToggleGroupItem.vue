<template>
    <ToggleGroupItem
        v-bind="forwardedProps"
        :class="
            cn(
                'inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                props.class,
            )
        "
    >
        <slot />
    </ToggleGroupItem>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ToggleGroupItem, type ToggleGroupItemProps, useForwardProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends ToggleGroupItemProps {
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
