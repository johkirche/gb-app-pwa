<template>
    <ion-list class="songs-list" lines="full">
        <ion-reorder-group :disabled="!reorderMode" @ionItemReorder="handleReorder">
            <ion-item
                v-for="song in songs"
                :key="song.id"
                class="song-row"
                :button="!reorderMode"
                lines="full"
                @click="handleSongClick(song)"
                @contextmenu.prevent="handleSongContextMenu(song)"
                v-long-press="() => handleSongLongPress(song)"
            >
                <span
                    slot="start"
                    class="song-row__number"
                    :class="{ 'song-row__number--empty': !song.index }"
                >
                    <template v-if="song.index">{{ song.index }}</template>
                    <span v-else class="song-row__number-dot" aria-hidden="true"></span>
                </span>
                <ion-label>
                    <span class="song-row__title">{{ song.titel }}</span>
                    <span v-if="song.kategorien.length > 0" class="song-row__category">
                        {{ formatCategories(song.kategorien) }}
                    </span>
                </ion-label>
                <ion-reorder v-if="reorderMode" slot="end"></ion-reorder>
            </ion-item>
        </ion-reorder-group>
    </ion-list>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList, IonReorder, IonReorderGroup } from '@ionic/vue';
import type { ItemReorderEventDetail } from '@ionic/vue';

import type { Category, Song } from '@/db';
import { longPressDirective as vLongPress } from '@/directives/longPress';

const props = defineProps<{
    songs: Song[];
    reorderMode: boolean;
}>();

const emit = defineEmits<{
    songClick: [song: Song];
    songContextMenu: [song: Song];
    reorder: [event: CustomEvent<ItemReorderEventDetail>];
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

function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    emit('reorder', event);
}

function formatCategories(categories: Category[]): string {
    return categories.map((c) => c.name).join(', ');
}
</script>

<style scoped>
.songs-list {
    margin-top: 1rem;
    padding-top: 0;
    padding-bottom: 0;
    background: transparent;
}

/* Number Box rows — matches the songs list and home screen */
.song-row {
    --background: transparent;
    --border-color: var(--ion-color-light-shade);
    --padding-start: var(--spacing-xs);
    --inner-padding-end: var(--spacing-sm);
    --min-height: 3.5rem;
}

.song-row__number {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.5rem;
    margin-inline-end: var(--spacing-md);
    border: 1px solid var(--ion-color-light-shade);
    border-radius: var(--radius-md);
    font-size: var(--font-size-lg);
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--ion-color-primary);
}

.song-row__number--empty {
    color: var(--ion-color-medium);
}

.song-row__number-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ion-color-medium);
    transform: rotate(45deg);
}

.song-row__title {
    display: block;
    font-size: var(--font-size-base);
    font-weight: 500;
    line-height: 1.3;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: break-word;
}

.song-row__category {
    display: block;
    margin-top: 2px;
    font-size: var(--font-size-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ion-color-medium);
}

.song-row__chevron {
    color: var(--ion-color-medium);
    font-size: var(--font-size-base);
}
</style>
