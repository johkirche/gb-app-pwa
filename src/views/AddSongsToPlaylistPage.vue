<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button
                        :default-href="`/playlists/${playlistId}`"
                        text=""
                    ></ion-back-button>
                </ion-buttons>
                <ion-title>Lieder hinzufügen</ion-title>
                <ion-buttons slot="end">
                    <ion-button :disabled="selectedSongs.size === 0" @click="addSelectedSongs">
                        <ion-icon slot="start" :icon="checkmarkOutline"></ion-icon>
                        {{ selectedSongs.size > 0 ? `(${selectedSongs.size})` : '' }}
                    </ion-button>
                </ion-buttons>
            </ion-toolbar>

            <!-- Search Bar -->
            <ion-toolbar>
                <ion-searchbar
                    v-model="searchQuery"
                    placeholder="Lieder suchen..."
                    :debounce="300"
                    @ionClear="searchQuery = ''"
                ></ion-searchbar>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true" :class="{ 'has-selection-footer': selectedSongs.size > 0 }">
            <!-- Loading State -->
            <div v-if="isLoading" class="state-container">
                <ion-spinner name="crescent"></ion-spinner>
            </div>

            <!-- Empty Results -->
            <div v-else-if="filteredSongs.length === 0" class="state-container empty-state">
                <ion-icon :icon="searchOutline" size="large"></ion-icon>
                <h2>Keine Ergebnisse</h2>
                <p v-if="searchQuery">Keine Lieder für "{{ searchQuery }}" gefunden.</p>
                <p v-else>Keine Lieder verfügbar.</p>
            </div>

            <!-- Songs List with Checkboxes -->
            <ion-list v-else>
                <ion-item v-for="song in filteredSongs" :key="song.id">
                    <ion-checkbox
                        class="ion-item-checklist"
                        :checked="selectedSongs.has(song.id)"
                        @ionChange="toggleSong(song.id)"
                        label-placement="end"
                        justify="start"
                    >
                        <ion-label class="ion-text-wrap">
                            <h2>
                                <span v-if="song.index" class="song-index">{{ song.index }}.</span>
                                {{ song.titel }}
                            </h2>
                            <p v-if="song.kategorien.length > 0">
                                {{ formatCategories(song.kategorien) }}
                            </p>
                            <p v-if="isInPlaylist(song.id)" class="already-added">
                                <ion-icon :icon="checkmarkCircle"></ion-icon>
                                Bereits in Playlist
                            </p>
                        </ion-label>
                    </ion-checkbox>
                </ion-item>
            </ion-list>
        </ion-content>

        <!-- Selection Summary Footer -->
        <ion-footer v-if="selectedSongs.size > 0">
            <ion-toolbar>
                <ion-button expand="block" @click="addSelectedSongs">
                    <ion-icon slot="start" :icon="addOutline"></ion-icon>
                    {{ selectedSongs.size }}
                    {{ selectedSongs.size === 1 ? 'Lied' : 'Lieder' }} hinzufügen
                </ion-button>
            </ion-toolbar>
        </ion-footer>
    </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonSearchbar,
    IonSpinner,
    IonTitle,
    IonToolbar,
} from '@ionic/vue';
import { addOutline, checkmarkCircle, checkmarkOutline, searchOutline } from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { usePlaylistsStore } from '@/stores/playlists';
import { useSongsStore } from '@/stores/songs';

import type { Category } from '@/db';

const route = useRoute();
const router = useRouter();
const playlistsStore = usePlaylistsStore();
const songsStore = useSongsStore();

const { songs: allSongs, isLoading } = storeToRefs(songsStore);

// State
const searchQuery = ref('');
const selectedSongs = ref<Set<string>>(new Set());

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

<style scoped>
.song-index {
    font-weight: 600;
    color: var(--ion-color-primary);
    margin-right: 4px;
}

.already-added {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--ion-color-success);
    font-size: 0.85rem;
}

.already-added ion-icon {
    font-size: 1rem;
}

.ion-item-checklist {
    padding-left: var(--spacing-md);
}

.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    min-height: 50vh;
}

.state-container > ion-icon {
    font-size: 64px;
    color: var(--ion-color-medium);
    margin-bottom: 16px;
}

.state-container h2 {
    margin: 0 0 8px;
    color: var(--ion-color-dark);
}

.state-container p {
    margin: 0;
    color: var(--ion-color-medium);
}

ion-content.has-selection-footer {
    --padding-bottom: 72px;
}

ion-footer ion-toolbar {
    padding: 8px 16px;
}

ion-footer ion-button {
    margin: 0;
}
</style>
