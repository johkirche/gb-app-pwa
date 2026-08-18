<template>
    <VaulDrawerOverlay :class="cn('fixed inset-0 z-50 bg-black/40', props.class)" />
</template>

<script setup lang="ts">
import { DrawerOverlay as VaulDrawerOverlay } from 'vaul-vue';

import { cn } from '@/lib/utils';

interface Props {
    class?: string;
}

const props = defineProps<Props>();
</script>
