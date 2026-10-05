<template>
    <!-- Under a Testament's heading: how far through it the reader is. -->
    <div v-if="progress.read > 0" class="mt-1 flex items-center gap-3 px-2">
        <Progress :model-value="progress.read / progress.total" class="h-1.5 flex-1" />
        <span class="shrink-0 text-sm text-muted-foreground">
            {{ progress.read }} von {{ progress.total }} Kapiteln gelesen
        </span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';

import { Progress } from '@/components/ui/progress';

const props = defineProps<{ testament: 'AT' | 'NT' }>();

const fortschritt = useBibelFortschrittStore();
const progress = computed(() => fortschritt.testamentProgress(props.testament));
</script>
