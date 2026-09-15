<template>
    <!-- The bar reads like the running head of a book: where this page is in
         what is being read, and a way to the page either side. The neighbours
         are named by number, which is how a hymn is called out; the title is
         there for the screen reader and for a wide screen. -->
    <nav
        class="flex h-12 items-center gap-1 border-t border-border bg-background px-1"
        aria-label="Lied wechseln"
    >
        <Button
            variant="ghost"
            class="h-10 min-w-0 shrink-0 gap-1 px-2 sm:max-w-[40%]"
            :disabled="!prev"
            :aria-label="prev ? `Vorheriges Lied: ${describe(prev)}` : 'Kein vorheriges Lied'"
            @click="emit('prev')"
        >
            <ChevronLeft class="!size-5" aria-hidden="true" />
            <span v-if="prev" class="flex min-w-0 items-baseline gap-1.5">
                <span v-if="prev.index" class="number-display text-base leading-none">
                    {{ prev.index }}
                </span>
                <span class="hidden truncate text-[13px] font-normal lg:inline">
                    {{ prev.titel }}
                </span>
            </span>
        </Button>

        <div class="min-w-0 flex-1 text-center" aria-live="polite">
            <p class="label-micro truncate text-muted-foreground">{{ label }}</p>
            <p v-if="total > 0" class="text-[13px] leading-tight text-muted-foreground">
                <span class="number-display">{{ position }}</span>
                von
                <span class="number-display">{{ total }}</span>
            </p>
        </div>

        <Button
            variant="ghost"
            class="h-10 min-w-0 shrink-0 gap-1 px-2 sm:max-w-[40%]"
            :disabled="!next"
            :aria-label="next ? `Nächstes Lied: ${describe(next)}` : 'Kein nächstes Lied'"
            @click="emit('next')"
        >
            <span v-if="next" class="flex min-w-0 items-baseline gap-1.5">
                <span class="hidden truncate text-[13px] font-normal lg:inline">
                    {{ next.titel }}
                </span>
                <span v-if="next.index" class="number-display text-base leading-none">
                    {{ next.index }}
                </span>
            </span>
            <ChevronRight class="!size-5" aria-hidden="true" />
        </Button>
    </nav>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';

import type { Song } from '@/db';

type Neighbour = Pick<Song, 'id' | 'index' | 'titel'>;

defineProps<{
    /** What order is being walked — „Liederliste", „Playlist Advent" … */
    label: string;
    /** 1-based place of the open song in that order */
    position: number;
    total: number;
    prev: Neighbour | null;
    next: Neighbour | null;
}>();

const emit = defineEmits<{
    prev: [];
    next: [];
}>();

function describe(song: Neighbour): string {
    return song.index ? `${song.index}. ${song.titel}` : song.titel;
}
</script>
