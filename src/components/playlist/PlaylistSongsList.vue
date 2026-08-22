<template>
    <VueDraggable
        :model-value="entries"
        tag="ul"
        class="mt-4 divide-y divide-border"
        handle="[data-drag-handle]"
        :disabled="!reorderMode"
        :animation="150"
        @update:model-value="handleReorder"
    >
        <li v-for="entry in entries" :key="entry.id">
            <component
                :is="rowTag(entry)"
                v-long-press="(el: HTMLElement) => handleSongLongPress(entry, el)"
                :type="rowTag(entry) === 'button' ? 'button' : undefined"
                class="flex w-full select-none items-center gap-4 px-2 py-2.5 text-left [-webkit-touch-callout:none]"
                :class="
                    reorderMode || !entry.song
                        ? ''
                        : 'rounded-sm transition-colors hover:bg-muted active:bg-muted'
                "
                @click="handleSongClick(entry)"
                @contextmenu.prevent="handleSongContextMenu(entry, anchorFromEvent($event))"
            >
                <span
                    class="number-display flex w-10 shrink-0 items-center justify-end text-lg leading-none"
                    :class="entry.song ? '' : 'text-muted-foreground'"
                >
                    <template v-if="entry.song?.index">{{ entry.song.index }}</template>
                    <span
                        v-else
                        class="inline-block h-1.5 w-1.5 rotate-45 rounded-full bg-muted-foreground"
                        aria-hidden="true"
                    ></span>
                </span>

                <!-- An id the library has no song for still gets its row: it is
                     what the playlist stores, it is counted on the list screen,
                     and the reader needs somewhere to remove it from. -->
                <span v-if="!entry.song" class="min-w-0 flex-1 text-muted-foreground">
                    <span class="block font-display text-[17px] italic leading-snug">
                        Lied derzeit nicht verfügbar
                    </span>
                    <span class="mt-0.5 block text-[11px] uppercase tracking-[0.14em]">
                        Nach dem Synchronisieren wieder da
                    </span>
                </span>

                <span v-else class="min-w-0 flex-1">
                    <span class="block break-words font-display text-[17px] leading-snug">
                        {{ entry.song.titel }}
                    </span>
                    <span
                        v-if="entry.song.kategorien.length > 0"
                        class="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                        {{ formatCategories(entry.song.kategorien) }}
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

import type { Category } from '@/db';
import { longPressDirective as vLongPress } from '@/directives/longPress';
import { type PanelAnchor, anchorFromEvent } from '@/lib/anchor';
import type { PlaylistEntry } from '@/utils/playlistEntries';

const props = defineProps<{
    entries: PlaylistEntry[];
    reorderMode: boolean;
}>();

const emit = defineEmits<{
    entryClick: [entry: PlaylistEntry];
    /** The anchor is the row (or click point) the desktop popover opens against. */
    entryContextMenu: [entry: PlaylistEntry, anchor: PanelAnchor];
    /** Complete reordered list of the playlist's song ids after a drop. */
    reorder: [songIds: string[]];
}>();

// A row that leads nowhere is not a button — it must not take focus or answer
// to Enter the way the songs around it do.
function rowTag(entry: PlaylistEntry): 'button' | 'div' {
    return props.reorderMode || !entry.song ? 'div' : 'button';
}

function handleSongClick(entry: PlaylistEntry) {
    if (!props.reorderMode && entry.song) {
        emit('entryClick', entry);
    }
}

function handleSongContextMenu(entry: PlaylistEntry, anchor: PanelAnchor) {
    if (!props.reorderMode) {
        emit('entryContextMenu', entry, anchor);
    }
}

function handleSongLongPress(entry: PlaylistEntry, anchor: PanelAnchor) {
    if (!props.reorderMode) {
        emit('entryContextMenu', entry, anchor);
    }
}

function handleReorder(reordered: PlaylistEntry[]) {
    emit(
        'reorder',
        reordered.map((entry) => entry.id),
    );
}

function formatCategories(categories: Category[]): string {
    return categories.map((c) => c.name).join(', ');
}
</script>
