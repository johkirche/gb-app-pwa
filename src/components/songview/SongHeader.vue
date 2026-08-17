<template>
    <AppPageHeader>
        <template #leading>
            <BackButton default-href="/tabs/lieder" />
        </template>
        <span v-if="songIndex" class="number-display mr-[0.4em]">{{ songIndex }}.</span>
        <span>{{ songTitle }}</span>
        <template #trailing>
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

import { Heart } from 'lucide-vue-next';

import { useFavoritesStore } from '@/stores/favorites';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';

const props = defineProps<{
    songId?: string;
    songIndex?: number;
    songTitle?: string;
}>();

const favoritesStore = useFavoritesStore();

const isFavorited = computed(() =>
    props.songId ? favoritesStore.isFavorite(props.songId) : false,
);

function toggleFavorite() {
    if (!props.songId) return;
    favoritesStore.toggleFavorite(props.songId);
}
</script>
