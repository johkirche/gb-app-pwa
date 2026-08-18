<template>
    <div class="flex items-center justify-center gap-4 px-4 py-2">
        <Button
            variant="ghost"
            size="icon"
            :class="loopEnabled ? 'text-primary' : 'text-muted-foreground'"
            aria-label="Wiederholung"
            @click="$emit('update:loopEnabled', !loopEnabled)"
        >
            <Repeat class="!size-5" aria-hidden="true" />
        </Button>

        <Button
            size="icon"
            class="h-11 w-11 rounded-full"
            :aria-label="isPlaying ? 'Pause' : 'Wiedergabe'"
            @click="$emit('togglePlay')"
        >
            <Pause v-if="isPlaying" class="!size-5 fill-current" aria-hidden="true" />
            <Play v-else class="!size-5 fill-current" aria-hidden="true" />
        </Button>

        <Button
            variant="ghost"
            size="icon"
            class="text-muted-foreground"
            :disabled="!isPlaying && !hasPaused"
            aria-label="Zum Anfang"
            @click="$emit('stop')"
        >
            <SkipBack class="!size-5" aria-hidden="true" />
        </Button>

        <div class="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Tempo verringern"
                @click="$emit('decreaseTempo')"
            >
                <Minus aria-hidden="true" />
            </Button>
            <span
                class="min-w-[64px] text-center text-sm font-medium tabular-nums text-muted-foreground"
            >
                {{ tempo }} BPM
            </span>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Tempo erhöhen"
                @click="$emit('increaseTempo')"
            >
                <Plus aria-hidden="true" />
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Minus, Pause, Play, Plus, Repeat, SkipBack } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';

defineProps<{
    isPlaying: boolean;
    hasPaused: boolean;
    loopEnabled: boolean;
    tempo: number;
}>();

defineEmits<{
    togglePlay: [];
    stop: [];
    increaseTempo: [];
    decreaseTempo: [];
    'update:loopEnabled': [value: boolean];
}>();
</script>
