<template>
    <div class="relative flex h-full flex-col bg-background">
        <AppPageHeader title="Playlisten" />

        <main ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="mx-auto w-full max-w-xl px-4 pb-24">
                <!-- Loading State -->
                <div
                    v-if="isLoading"
                    class="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
                >
                    <Spinner size="lg" />
                    <p class="text-sm text-muted-foreground">Playlisten werden geladen...</p>
                </div>

                <template v-else>
                    <ul class="mt-2 divide-y divide-border">
                        <!-- Pinned Favoriten entry (always above the playlists) -->
                        <li>
                            <button
                                type="button"
                                class="flex w-full items-center gap-4 rounded-sm px-2 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                                @click="navigateToFavorites"
                            >
                                <span
                                    class="flex h-10 w-11 shrink-0 items-center justify-center rounded-md border border-border"
                                >
                                    <Heart
                                        class="size-[1.375rem] text-destructive"
                                        fill="currentColor"
                                        aria-hidden="true"
                                    />
                                </span>
                                <span class="min-w-0 flex-1">
                                    <span class="block text-[15px] font-medium leading-tight">
                                        Favoriten
                                    </span>
                                    <span class="mt-0.5 block text-sm text-muted-foreground">
                                        {{ favoriteCountLabel }}
                                    </span>
                                </span>
                            </button>
                        </li>

                        <!-- Playlists -->
                        <li v-for="playlist in sortedPlaylists" :key="playlist.id">
                            <button
                                v-long-press="() => showActionSheet(playlist)"
                                type="button"
                                class="flex w-full select-none items-center gap-4 rounded-sm px-2 py-2.5 text-left transition-colors [-webkit-touch-callout:none] hover:bg-muted active:bg-muted"
                                @click="navigateToPlaylist(playlist.id)"
                            >
                                <span
                                    class="flex h-10 w-11 shrink-0 items-center justify-center rounded-md border border-border text-[1.375rem] leading-none"
                                >
                                    {{ playlist.emoji }}
                                </span>
                                <span class="min-w-0 flex-1">
                                    <span
                                        class="block break-words text-[15px] font-medium leading-tight"
                                    >
                                        {{ playlist.name }}
                                    </span>
                                    <span class="mt-0.5 block text-sm text-muted-foreground">
                                        {{ playlist.songIds.length }}
                                        {{ playlist.songIds.length === 1 ? 'Lied' : 'Lieder' }}
                                        · {{ formatDate(playlist.createdAt) }}
                                    </span>
                                </span>
                            </button>
                        </li>
                    </ul>
                    <Separator v-if="hasPlaylists" />

                    <!-- Empty State -->
                    <div
                        v-if="!hasPlaylists"
                        class="flex flex-col items-center border-t border-border px-6 py-16 text-center"
                    >
                        <Library
                            class="size-14 text-muted-foreground"
                            stroke-width="1.25"
                            aria-hidden="true"
                        />
                        <h2 class="mt-4 font-display text-2xl font-semibold">Keine Playlisten</h2>
                        <p class="mt-2 max-w-xs text-sm text-muted-foreground">
                            Erstellen Sie Ihre erste Playlist, um Lieder zu organisieren.
                        </p>
                        <Button class="mt-6" @click="navigateToCreate">
                            <Plus aria-hidden="true" />
                            Playlist erstellen
                        </Button>
                    </div>
                </template>
            </div>
        </main>

        <!-- FAB for creating new playlist -->
        <Button
            v-if="!isLoading && hasPlaylists"
            size="icon"
            class="absolute bottom-5 right-5 z-10 h-14 w-14 rounded-full shadow-lg"
            aria-label="Playlist erstellen"
            @click="navigateToCreate"
        >
            <Plus class="!size-6" aria-hidden="true" />
        </Button>

        <!-- Long-press context menu -->
        <ActionSheet
            v-model:open="actionSheetOpen"
            :title="actionSheetPlaylist?.name"
            :actions="actionSheetActions"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Heart, Library, Plus, Trash2, X } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { useFavoritesStore } from '@/stores/favorites';
import { usePlaylistsStore } from '@/stores/playlists';

import { useKeepAliveScroll } from '@/composables/useKeepAliveScroll';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import { Button } from '@/components/ui/button';
import { ActionSheet, type ActionSheetAction } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

import type { Playlist } from '@/db';
import { longPressDirective as vLongPress } from '@/directives/longPress';

const router = useRouter();

// KeepAlive resets scrollTop on re-attach; save/restore it (Ionic parity)
const scrollRef = ref<HTMLElement | null>(null);
useKeepAliveScroll(scrollRef);

const playlistsStore = usePlaylistsStore();
const favoritesStore = useFavoritesStore();
const { isLoading, hasPlaylists, sortedPlaylists } = storeToRefs(playlistsStore);

const favoriteCountLabel = computed(() => {
    const count = favoritesStore.favorites.length;
    return count === 1 ? '1 Lied' : `${count} Lieder`;
});

function navigateToFavorites() {
    router.push('/favorites');
}

function navigateToCreate() {
    router.push('/playlists/create');
}

function navigateToPlaylist(id: string) {
    router.push(`/playlists/${id}`);
}

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date));
}

// Long-press context menu (delete without confirmation, as before)
const actionSheetOpen = ref(false);
const actionSheetPlaylist = ref<Playlist | null>(null);

const actionSheetActions = computed<ActionSheetAction[]>(() => [
    {
        label: 'Löschen',
        role: 'destructive',
        icon: Trash2,
        handler: () => {
            if (actionSheetPlaylist.value) {
                deletePlaylist(actionSheetPlaylist.value);
            }
        },
    },
    {
        label: 'Abbrechen',
        role: 'cancel',
        icon: X,
    },
]);

function showActionSheet(playlist: Playlist) {
    if (actionSheetOpen.value) return;
    actionSheetPlaylist.value = playlist;
    actionSheetOpen.value = true;
}

async function deletePlaylist(playlist: Playlist) {
    try {
        await playlistsStore.deletePlaylist(playlist.id);
    } catch (error) {
        console.error('Failed to delete playlist:', error);
    }
}
</script>
