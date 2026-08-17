<template>
    <div class="mb-6 overflow-x-auto rounded-lg bg-muted p-2">
        <div
            v-if="isLoading"
            class="flex flex-col items-center justify-center gap-2 p-8 text-center"
        >
            <Spinner />
            <p class="text-sm text-muted-foreground">Notenbild wird geladen...</p>
        </div>
        <img
            v-else-if="imageUrl"
            :src="imageUrl"
            alt="Notenbild"
            class="block h-auto w-full rounded-md"
        />
        <div v-else class="flex items-center justify-center gap-2 p-6 italic text-muted-foreground">
            <ImageIcon class="size-5 shrink-0" aria-hidden="true" />
            <span>Notenbild nicht verfügbar</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Image as ImageIcon } from 'lucide-vue-next';

import { Spinner } from '@/components/ui/spinner';

defineProps<{
    imageUrl: string | null;
    isLoading: boolean;
}>();
</script>
