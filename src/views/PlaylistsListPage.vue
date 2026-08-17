<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-title>Playlisten</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true">
            <!-- Loading State -->
            <div v-if="isLoading" class="state-container">
                <ion-spinner name="crescent"></ion-spinner>
                <p>Playlisten werden geladen...</p>
            </div>

            <template v-else>
                <!-- Pinned Favoriten entry (always above the playlists) -->
                <ion-list class="playlist-list" lines="full">
                    <ion-item class="playlist-row" button @click="navigateToFavorites">
                        <span slot="start" class="playlist-row__icon playlist-row__icon--favorites">
                            <ion-icon :icon="heart"></ion-icon>
                        </span>
                        <ion-label>
                            <span class="playlist-row__title">Favoriten</span>
                            <span class="playlist-row__meta">{{ favoriteCountLabel }}</span>
                        </ion-label>
                        <ion-icon
                            slot="end"
                            class="playlist-row__chevron"
                            :icon="chevronForwardOutline"
                            aria-hidden="true"
                        ></ion-icon>
                    </ion-item>
                </ion-list>

                <!-- Empty State -->
                <div v-if="!hasPlaylists" class="state-container empty-state">
                    <ion-icon :icon="albumsOutline" size="large"></ion-icon>
                    <h2>Keine Playlisten</h2>
                    <p>Erstellen Sie Ihre erste Playlist, um Lieder zu organisieren.</p>
                    <ion-button
                        @click="navigateToCreate"
                        class="create-button"
                        size="default"
                        fill="solid"
                    >
                        <ion-icon slot="start" :icon="addOutline"></ion-icon>
                        Playlist erstellen
                    </ion-button>
                </div>

                <!-- Playlists List -->
                <ion-list v-else class="playlist-list" lines="full">
                    <ion-item
                        v-for="playlist in sortedPlaylists"
                        :key="playlist.id"
                        class="playlist-row"
                        button
                        v-long-press="() => showActionSheet(playlist)"
                        @click="navigateToPlaylist(playlist.id)"
                    >
                        <span slot="start" class="playlist-row__icon">
                            {{ playlist.emoji }}
                        </span>
                        <ion-label>
                            <span class="playlist-row__title">{{ playlist.name }}</span>
                            <span class="playlist-row__meta">
                                {{ playlist.songIds.length }}
                                {{ playlist.songIds.length === 1 ? 'Lied' : 'Lieder' }}
                                · {{ formatDate(playlist.createdAt) }}
                            </span>
                        </ion-label>
                        <ion-icon
                            slot="end"
                            class="playlist-row__chevron"
                            :icon="chevronForwardOutline"
                            aria-hidden="true"
                        ></ion-icon>
                    </ion-item>
                </ion-list>
            </template>

            <!-- FAB for creating new playlist -->
            <ion-fab v-if="hasPlaylists" slot="fixed" vertical="bottom" horizontal="end">
                <ion-fab-button @click="navigateToCreate">
                    <ion-icon :icon="addOutline"></ion-icon>
                </ion-fab-button>
            </ion-fab>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonSpinner,
    IonTitle,
    IonToolbar,
    actionSheetController,
} from '@ionic/vue';
import {
    addOutline,
    albumsOutline,
    chevronForwardOutline,
    closeOutline,
    heart,
    trashOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { useFavoritesStore } from '@/stores/favorites';
import { usePlaylistsStore } from '@/stores/playlists';

import type { Playlist } from '@/db';
import { longPressDirective as vLongPress } from '@/directives/longPress';

const router = useRouter();
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

async function showActionSheet(playlist: Playlist) {
    const actionSheet = await actionSheetController.create({
        header: playlist.name,
        buttons: [
            {
                text: 'Löschen',
                role: 'destructive',
                icon: trashOutline,
                handler: () => {
                    deletePlaylist(playlist);
                },
            },
            {
                text: 'Abbrechen',
                role: 'cancel',
                icon: closeOutline,
            },
        ],
    });

    await actionSheet.present();
}

async function deletePlaylist(playlist: Playlist) {
    try {
        await playlistsStore.deletePlaylist(playlist.id);
    } catch (error) {
        console.error('Failed to delete playlist:', error);
    }
}
</script>

<style scoped>
.playlist-list {
    padding-top: 0;
    padding-bottom: 0;
    background: transparent;
}

/* Number Box style rows — matches the songs list and home screen, with the emoji in the box */
.playlist-row {
    --background: transparent;
    --border-color: var(--ion-color-light-shade);
    --padding-start: var(--spacing-xs);
    --inner-padding-end: var(--spacing-sm);
    --min-height: 3.5rem;
}

.playlist-row__icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.5rem;
    margin-inline-end: var(--spacing-md);
    border: 1px solid var(--ion-color-light-shade);
    border-radius: var(--radius-md);
    font-size: 1.375rem;
    line-height: 1;
}

/* Favoriten pinned entry — same box as playlist emojis, with a heart icon */
.playlist-row__icon--favorites ion-icon {
    font-size: 1.375rem;
    color: var(--ion-color-danger);
}

.playlist-row__title {
    display: block;
    font-size: var(--font-size-base);
    font-weight: 500;
    line-height: 1.3;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: break-word;
}

.playlist-row__meta {
    display: block;
    margin-top: 2px;
    font-size: var(--font-size-sm);
    color: var(--ion-color-medium);
}

.playlist-row__chevron {
    color: var(--ion-color-medium);
    font-size: var(--font-size-base);
}

.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    min-height: 60vh;
}

.state-container ion-icon {
    font-size: 64px;
    color: var(--ion-color-medium);
}

.state-container h2 {
    margin: 0 0 8px;
    color: var(--ion-color-dark);
}

.state-container p {
    margin: 0 0 16px;
    color: var(--ion-color-medium);
}

.empty-state .create-button {
    margin-top: 24px;
    --padding-start: 24px;
    --padding-end: 24px;
    --padding-top: 12px;
    --padding-bottom: 12px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0.5px;
}

.empty-state .create-button ion-icon {
    color: white;
    margin-right: 8px;
    font-size: 20px;
}
</style>
