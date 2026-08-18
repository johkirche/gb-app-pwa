<template>
    <VaulDrawerDescription :class="cn('text-sm text-muted-foreground', props.class)">
        <slot />
    </VaulDrawerDescription>
</template>

<script setup lang="ts">
import { DrawerDescription as VaulDrawerDescription } from 'vaul-vue';

import { cn } from '@/lib/utils';

interface Props {
    class?: string;
}

const props = defineProps<Props>();
</script>
