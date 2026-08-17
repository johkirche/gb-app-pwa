<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Lieder hinzufügen">
            <template #leading>
                <BackButton :default-href="`/playlists/${playlistId}`" />
            </template>
            <template #trailing>
                <Button
                    variant="ghost"
                    class="text-primary"
                    :disabled="selectedSongs.size === 0"
                    aria-label="Lieder hinzufügen"
                    @click="addSelectedSongs"
                >
                    <Check aria-hidden="true" />
                    <span v-if="selectedSongs.size > 0">({{ selectedSongs.size }})</span>
                </Button>
            </template>
        </AppPageHeader>

        <!-- Search Bar (sticky: sits outside the scroll container) -->
        <div class="shrink-0 border-b border-border bg-background px-4 py-2">
            <div class="relative mx-auto w-full max-w-xl">
                <Search
                    class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input v-model="searchInput" placeholder="Lieder suchen..." class="pl-9 pr-10" />
                <button
                    v-if="searchInput"
                    type="button"
                    class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Eingabe löschen"
                    @click="clearSearch"
                >
                    <X class="size-4" aria-hidden="true" />
                </button>
            </div>
        </div>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="mx-auto w-full max-w-xl px-4 pb-6">
                <!-- Loading State -->
                <div v-if="isLoading" class="flex min-h-[50vh] items-center justify-center">
                    <Spinner size="lg" />
                </div>

                <!-- Empty Results -->
                <div
                    v-else-if="filteredSongs.length === 0"
                    class="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12 text-center"
                >
                    <Search
                        class="size-14 text-muted-foreground"
                        stroke-width="1.25"
                        aria-hidden="true"
                    />
                    <h2 class="mt-4 font-display text-2xl font-semibold">Keine Ergebnisse</h2>
                    <p v-if="searchQuery" class="mt-2 text-sm text-muted-foreground">
                        Keine Lieder für "{{ searchQuery }}" gefunden.
                    </p>
                    <p v-else class="mt-2 text-sm text-muted-foreground">Keine Lieder verfügbar.</p>
                </div>

                <!-- Songs List with Checkboxes -->
                <ul v-else class="divide-y divide-border">
                    <li v-for="song in filteredSongs" :key="song.id">
                        <!-- The label wraps the checkbox, so the whole row text is the
                             checkbox's accessible name and a tap anywhere toggles exactly
                             once (the checkbox is the only event source). -->
                        <label
                            class="flex w-full cursor-pointer items-start gap-3 rounded-sm px-2 py-3 transition-colors hover:bg-muted"
                        >
                            <Checkbox
                                class="mt-0.5 size-5"
                                :model-value="selectedSongs.has(song.id)"
                                @update:model-value="toggleSong(song.id)"
                            />
                            <span class="min-w-0 flex-1">
                                <span class="block break-words text-[15px] leading-snug">
                                    <span v-if="song.index" class="font-semibold text-primary">
                                        {{ song.index }}.
                                    </span>
                                    {{ song.titel }}
                                </span>
                                <span
                                    v-if="song.kategorien.length > 0"
                                    class="mt-0.5 block text-sm text-muted-foreground"
                                >
                                    {{ formatCategories(song.kategorien) }}
                                </span>
                                <span
                                    v-if="isInPlaylist(song.id)"
                                    class="mt-0.5 flex items-center gap-1 text-[13px] text-green-600 dark:text-green-500"
                                >
                                    <CircleCheck class="size-4" aria-hidden="true" />
                                    Bereits in Playlist
                                </span>
                            </span>
                        </label>
                    </li>
                </ul>
            </div>
        </main>

        <!-- Selection Summary Footer (docked; in flow, so the list is never covered) -->
        <div
            v-if="selectedSongs.size > 0"
            class="shrink-0 border-t border-border bg-background px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2"
        >
            <div class="mx-auto w-full max-w-xl">
                <Button class="w-full" size="lg" @click="addSelectedSongs">
                    <Plus aria-hidden="true" />
                    {{ selectedSongs.size }}
                    {{ selectedSongs.size === 1 ? 'Lied' : 'Lieder' }} hinzufügen
                </Button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';

import { Check, CircleCheck, Plus, Search, X } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { usePlaylistsStore } from '@/stores/playlists';
import { useSongsStore } from '@/stores/songs';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

import type { Category } from '@/db';

const route = useRoute();
const router = useRouter();
const playlistsStore = usePlaylistsStore();
const songsStore = useSongsStore();

const { songs: allSongs, isLoading } = storeToRefs(songsStore);

// State — the raw input is debounced (300 ms, as the Ionic searchbar did)
// into searchQuery, which drives filtering and the empty-state copy.
const searchInput = ref('');
const searchQuery = ref('');
const selectedSongs = ref<Set<string>>(new Set());

let searchDebounce: ReturnType<typeof setTimeout> | undefined;
watch(searchInput, (value) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        searchQuery.value = value;
    }, 300);
});

onUnmounted(() => {
    clearTimeout(searchDebounce);
});

function clearSearch() {
    clearTimeout(searchDebounce);
    searchInput.value = '';
    searchQuery.value = '';
}

// Get playlist ID from route
const playlistId = computed(() => route.params.id as string);

// Get current playlist
const playlist = computed(() => playlistsStore.getPlaylistById(playlistId.value));

// Filter songs by search query
const filteredSongs = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    let songs = [...allSongs.value].sort((a, b) => a.index - b.index);

    if (query) {
        songs = songs.filter(
            (song) =>
                song.titel.toLowerCase().includes(query) ||
                song.index.toString().includes(query) ||
                song.kategorien.some((k) => k.name.toLowerCase().includes(query)),
        );
    }

    return songs;
});

// Check if song is already in playlist
function isInPlaylist(songId: string): boolean {
    return playlist.value?.songIds.includes(songId) ?? false;
}

// Toggle song selection
function toggleSong(songId: string) {
    const newSelected = new Set(selectedSongs.value);
    if (newSelected.has(songId)) {
        newSelected.delete(songId);
    } else {
        newSelected.add(songId);
    }
    selectedSongs.value = newSelected;
}

// Add selected songs to playlist
async function addSelectedSongs() {
    if (selectedSongs.value.size === 0 || !playlist.value) return;

    try {
        await playlistsStore.addSongsToPlaylist(playlistId.value, Array.from(selectedSongs.value));
        router.back();
    } catch (error) {
        console.error('Failed to add songs:', error);
    }
}

// Format categories
function formatCategories(categories: Category[]): string {
    return categories.map((c) => c.name).join(', ');
}
</script>
