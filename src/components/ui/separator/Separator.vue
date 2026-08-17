<template>
    <Separator
        :as="as"
        :as-child="asChild"
        :orientation="orientation"
        :decorative="decorative"
        :class="
            cn(
                'shrink-0 bg-border',
                orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
                props.class,
            )
        "
    />
</template>

<script setup lang="ts">
import { Separator, type SeparatorProps } from 'reka-ui';

import { cn } from '@/lib/utils';

interface Props extends SeparatorProps {
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    orientation: 'horizontal',
    decorative: true,
    class: undefined,
});
</script>
