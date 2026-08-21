<template>
    <VueDraggable
        :model-value="songs"
        tag="ol"
        class="mt-2 divide-y divide-border"
        handle="[data-drag-handle]"
        :disabled="!reorderMode"
        :animation="150"
        @update:model-value="handleReorder"
    >
        <li v-for="(song, position) in songs" :key="song.id">
            <component
                :is="reorderMode ? 'div' : 'button'"
                v-long-press="(el: HTMLElement) => handleLongPress(song, el)"
                :type="reorderMode ? undefined : 'button'"
                class="flex w-full select-none items-center gap-4 px-2 py-3 text-left [-webkit-touch-callout:none]"
                :class="
                    reorderMode ? '' : 'rounded-sm transition-colors hover:bg-muted active:bg-muted'
                "
                @click="handleClick(song)"
                @contextmenu.prevent="handleContextMenu(song, anchorFromEvent($event))"
            >
                <!-- The position in the service, not the hymn number — that one
                     stays with the title, where it is read out from. -->
                <span
                    class="number-display flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-[13px] leading-none text-muted-foreground"
                    aria-hidden="true"
                >
                    {{ position + 1 }}
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block break-words font-display text-[17px] leading-snug">
                        <span v-if="song.index" class="number-display mr-0.5 text-lg">
                            {{ song.index }}.
                        </span>
                        <span>{{ song.titel }}</span>
                    </span>
                    <span
                        v-if="formatCategories(song.kategorien)"
                        class="label-micro mt-0.5 block text-muted-foreground"
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
import { type PanelAnchor, anchorFromEvent } from '@/lib/anchor';

const props = defineProps<{
    songs: Song[];
    reorderMode: boolean;
}>();

const emit = defineEmits<{
    songClick: [song: Song];
    /** The anchor is the row (or click point) the desktop popover opens against. */
    songContextMenu: [song: Song, anchor: PanelAnchor];
    /** Complete reordered list of the *rendered* song ids after a drop. */
    reorder: [songIds: string[]];
}>();

function handleClick(song: Song) {
    if (!props.reorderMode) emit('songClick', song);
}

function handleContextMenu(song: Song, anchor: PanelAnchor) {
    if (!props.reorderMode) emit('songContextMenu', song, anchor);
}

function handleLongPress(song: Song, anchor: PanelAnchor) {
    if (!props.reorderMode) emit('songContextMenu', song, anchor);
}

function handleReorder(reordered: Song[]) {
    emit(
        'reorder',
        reordered.map((song) => song.id),
    );
}

function formatCategories(categories: Category[]): string {
    return categories
        .map((c) => c.name?.trim())
        .filter((name): name is string => !!name)
        .join(', ');
}
</script>
