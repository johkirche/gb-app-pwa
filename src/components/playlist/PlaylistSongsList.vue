<template>
    <VueDraggable
        :model-value="songs"
        tag="ul"
        class="mt-4 divide-y divide-border"
        handle="[data-drag-handle]"
        :disabled="!reorderMode"
        :animation="150"
        @update:model-value="handleReorder"
    >
        <li v-for="song in songs" :key="song.id">
            <component
                :is="reorderMode ? 'div' : 'button'"
                v-long-press="() => handleSongLongPress(song)"
                :type="reorderMode ? undefined : 'button'"
                class="flex w-full select-none items-center gap-4 px-2 py-2.5 text-left [-webkit-touch-callout:none]"
                :class="
                    reorderMode ? '' : 'rounded-sm transition-colors hover:bg-muted active:bg-muted'
                "
                @click="handleSongClick(song)"
                @contextmenu.prevent="handleSongContextMenu(song)"
            >
                <span
                    class="number-display flex w-10 shrink-0 items-center justify-end text-lg leading-none"
                >
                    <template v-if="song.index">{{ song.index }}</template>
                    <span
                        v-else
                        class="inline-block h-1.5 w-1.5 rotate-45 rounded-full bg-muted-foreground"
                        aria-hidden="true"
                    ></span>
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block break-words font-display text-[17px] leading-snug">
                        {{ song.titel }}
                    </span>
                    <span
                        v-if="song.kategorien.length > 0"
                        class="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                        {{ formatCategories(song.kategorien) }}
                    </span>
                </span>
                <span
                    v-if="reorderMode"
                    data-drag-handle
                    class="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
                >
                    <GripVertical class="size-5" aria-hidden="true" />
                </span>
            </component>
        </li>
    </VueDraggable>
</template>

<script setup lang="ts">
import { GripVertical } from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';

import type { Category, Song } from '@/db';
import { longPressDirective as vLongPress } from '@/directives/longPress';

const props = defineProps<{
    songs: Song[];
    reorderMode: boolean;
}>();

const emit = defineEmits<{
    songClick: [song: Song];
    songContextMenu: [song: Song];
    /** Complete reordered list of the *rendered* song ids after a drop. */
    reorder: [songIds: string[]];
}>();

function handleSongClick(song: Song) {
    if (!props.reorderMode) {
        emit('songClick', song);
    }
}

function handleSongContextMenu(song: Song) {
    if (!props.reorderMode) {
        emit('songContextMenu', song);
    }
}

function handleSongLongPress(song: Song) {
    if (!props.reorderMode) {
        emit('songContextMenu', song);
    }
}

function handleReorder(reordered: Song[]) {
    emit(
        'reorder',
        reordered.map((song) => song.id),
    );
}

function formatCategories(categories: Category[]): string {
    return categories.map((c) => c.name).join(', ');
}
</script>
