<template>
    <Primitive :as="as" :as-child="asChild" :class="cn(badgeVariants({ variant }), props.class)">
        <slot />
    </Primitive>
</template>

<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui';

import { cn } from '@/lib/utils';

import { type BadgeVariants, badgeVariants } from './index';

interface Props extends PrimitiveProps {
    variant?: BadgeVariants['variant'];
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    as: 'span',
    variant: 'default',
    class: undefined,
});
</script>
