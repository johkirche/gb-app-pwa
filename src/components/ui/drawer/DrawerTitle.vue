<template>
    <VaulDrawerTitle :class="cn('font-display text-lg font-semibold text-foreground', props.class)">
        <slot />
    </VaulDrawerTitle>
</template>

<script setup lang="ts">
import { DrawerTitle as VaulDrawerTitle } from 'vaul-vue';

import { cn } from '@/lib/utils';

interface Props {
    class?: string;
}

const props = defineProps<Props>();
</script>
