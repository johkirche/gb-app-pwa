<template>
    <AppPageHeader>
        <template #leading>
            <BackButton default-href="/tabs/lieder" />
        </template>
        <span v-if="songIndex" class="number-display mr-[0.4em]">{{ songIndex }}.</span>
        <span>{{ songTitle }}</span>
        <template #trailing>
            <!-- The link that leaves here names the hymn by its number, which
                 is what a bulletin prints and a choir passes around. Only from
                 desktop width up: a phone's header has the title to carry and
                 three icons already crowd it, so there the entry lives in the
                 menu (see SongMenuPopover). -->
            <Button
                v-if="song"
                variant="ghost"
                size="icon"
                class="hidden lg:inline-flex"
                aria-label="Lied teilen"
                @click="share"
            >
                <Share2 class="!size-5" aria-hidden="true" />
            </Button>
            <Button
                v-if="songId"
                variant="ghost"
                size="icon"
                :aria-label="isFavorited ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'"
                @click="toggleFavorite"
            >
                <Heart
                    class="!size-5"
                    :class="{ 'fill-current text-destructive': isFavorited }"
                    aria-hidden="true"
                />
            </Button>
            <!-- Settings trigger + popover (SongMenuPopover) live in this slot
                 so Reka keeps trigger and content under one Popover root. -->
            <slot name="menu" />
        </template>
    </AppPageHeader>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Heart, Share2 } from 'lucide-vue-next';

import { useFavoritesStore } from '@/stores/favorites';

import { shareSong } from '@/composables/useShareSong';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';

import type { Song } from '@/db';

const props = defineProps<{
    songId?: string;
    songIndex?: number;
    songTitle?: string;
    /** The open hymn, for the share button — absent while it is still loading or not found */
    song?: Song | null;
}>();

const favoritesStore = useFavoritesStore();

const isFavorited = computed(() =>
    props.songId ? favoritesStore.isFavorite(props.songId) : false,
);

function toggleFavorite() {
    if (!props.songId) return;
    favoritesStore.toggleFavorite(props.songId);
}

function share() {
    if (!props.song) return;
    void shareSong(props.song);
}
</script>
