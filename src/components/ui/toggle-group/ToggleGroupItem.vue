<!--
    A segment wraps rather than refusing to: as one unbroken line it could not
    shrink below its label, and at large Größe three labels outgrew the track
    and pushed the last segment out of it. One line still fits min-h-8, so at
    the resting size nothing moves; past it, the segment gets taller instead.
-->
<template>
    <ToggleGroupItem
        v-bind="forwardedProps"
        :class="
            cn(
                'inline-flex min-h-8 min-w-0 items-center justify-center gap-2 hyphens-auto rounded-md px-3 py-1 text-center text-sm leading-tight font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
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
