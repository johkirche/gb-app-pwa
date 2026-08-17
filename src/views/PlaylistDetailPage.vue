<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button default-href="/tabs/playlisten" text=""></ion-back-button>
                </ion-buttons>
                <ion-title>
                    {{ reorderMode ? 'Reihenfolge ändern' : playlist?.name || 'Playlist' }}
                </ion-title>
                <ion-buttons slot="end">
                    <ion-button v-if="reorderMode" @click="toggleReorderMode" color="primary">
                        Fertig
                    </ion-button>
                    <ion-button v-else id="playlist-menu-trigger">
                        <ion-icon slot="icon-only" :icon="ellipsisVertical"></ion-icon>
                    </ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>

        <!-- Playlist Menu Popover -->
        <ion-popover trigger="playlist-menu-trigger" :dismiss-on-select="true">
            <ion-content>
                <ion-list lines="none">
                    <ion-item button @click="toggleReorderMode">
                        <ion-icon slot="start" :icon="reorderThreeOutline"></ion-icon>
                        <ion-label>Reihenfolge ändern</ion-label>
                    </ion-item>
                    <ion-item button @click="showEditModal = true">
                        <ion-icon slot="start" :icon="createOutline"></ion-icon>
                        <ion-label>Bearbeiten</ion-label>
                    </ion-item>
                    <ion-item button @click="confirmDelete">
                        <ion-icon slot="start" :icon="trashOutline" color="danger"></ion-icon>
                        <ion-label color="danger">Löschen</ion-label>
                    </ion-item>
                </ion-list>
            </ion-content>
        </ion-popover>

        <ion-content :fullscreen="true">
            <!-- Loading State -->
            <div v-if="isLoading" class="state-container">
                <ion-spinner name="crescent"></ion-spinner>
            </div>

            <!-- Playlist Not Found -->
            <div v-else-if="!playlist" class="state-container empty-state">
                <ion-icon :icon="alertCircleOutline" size="large"></ion-icon>
                <h2>Playlist nicht gefunden</h2>
                <ion-button @click="router.push('/tabs/playlisten')">
                    Zurück zu Playlisten
                </ion-button>
            </div>

            <!-- Playlist Content -->
            <template v-else>
                <!-- Playlist Header -->
                <PlaylistHeader
                    :emoji="playlist.emoji"
                    :name="playlist.name"
                    :song-count="songs.length"
                    :created-at="playlist.createdAt"
                />

                <!-- Empty Playlist State -->
                <div v-if="songs.length === 0" class="empty-playlist-state empty-state">
                    <ion-icon
                        class="playlist-icon"
                        :icon="musicalNotesOutline"
                        size="large"
                    ></ion-icon>
                    <h2>Keine Lieder</h2>
                    <p>Fügen Sie Lieder zu dieser Playlist hinzu.</p>
                    <ion-button
                        class="add-button"
                        size="default"
                        fill="solid"
                        @click="navigateToAddSongs"
                    >
                        <ion-icon slot="start" :icon="addOutline"></ion-icon>
                        Lieder hinzufügen
                    </ion-button>
                </div>

                <!-- Songs List -->
                <PlaylistSongsList
                    v-else
                    :songs="songs"
                    :reorder-mode="reorderMode"
                    @song-click="(song) => navigateToSong(song.id)"
                    @song-context-menu="showSongActions"
                    @reorder="handleReorder"
                />

                <!-- FAB for adding songs -->
                <ion-fab v-if="songs.length > 0" slot="fixed" vertical="bottom" horizontal="end">
                    <ion-fab-button @click="navigateToAddSongs">
                        <ion-icon :icon="addOutline"></ion-icon>
                    </ion-fab-button>
                </ion-fab>
            </template>

            <!-- Delete Confirmation Alert -->
            <ion-alert
                :is-open="showDeleteAlert"
                header="Playlist löschen?"
                :message="`Möchten Sie die Playlist '${playlist?.name}' wirklich löschen?`"
                :buttons="deleteAlertButtons"
                @didDismiss="showDeleteAlert = false"
            ></ion-alert>

            <!-- Edit Modal -->
            <PlaylistEditModal
                :is-open="showEditModal"
                :name="playlist?.name || ''"
                :emoji="playlist?.emoji || '🎵'"
                @close="showEditModal = false"
                @save="saveEdit"
            />
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
    IonAlert,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonPopover,
    IonSpinner,
    IonTitle,
    IonToolbar,
    actionSheetController,
} from '@ionic/vue';
import type { ItemReorderEventDetail } from '@ionic/vue';
import {
    addOutline,
    alertCircleOutline,
    createOutline,
    ellipsisVertical,
    musicalNotesOutline,
    reorderThreeOutline,
    trashOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { usePlaylistsStore } from '@/stores/playlists';
import { useSongsStore } from '@/stores/songs';

import PlaylistEditModal from '@/components/playlist/PlaylistEditModal.vue';
import PlaylistHeader from '@/components/playlist/PlaylistHeader.vue';
import PlaylistSongsList from '@/components/playlist/PlaylistSongsList.vue';

import type { Song } from '@/db';

const route = useRoute();
const router = useRouter();
const playlistsStore = usePlaylistsStore();
const songsStore = useSongsStore();

const { isLoading } = storeToRefs(playlistsStore);
const { songs: allSongs } = storeToRefs(songsStore);

// UI State
const showDeleteAlert = ref(false);
const showEditModal = ref(false);
const reorderMode = ref(false);

// Get current playlist
const playlist = computed(() => {
    const id = route.params.id as string;
    return playlistsStore.getPlaylistById(id);
});

// Get songs in playlist
const songs = computed<Song[]>(() => {
    if (!playlist.value) return [];
    return playlist.value.songIds
        .map((id) => allSongs.value.find((s) => s.id === id))
        .filter((s): s is Song => s !== undefined);
});

// Delete alert buttons
const deleteAlertButtons = [
    {
        text: 'Abbrechen',
        role: 'cancel',
    },
    {
        text: 'Löschen',
        role: 'destructive',
        handler: () => {
            deletePlaylist();
        },
    },
];

function confirmDelete() {
    showDeleteAlert.value = true;
}

async function deletePlaylist() {
    if (!playlist.value) return;
    try {
        await playlistsStore.deletePlaylist(playlist.value.id);
        router.replace('/tabs/playlisten');
    } catch (error) {
        console.error('Failed to delete playlist:', error);
    }
}

function toggleReorderMode() {
    reorderMode.value = !reorderMode.value;
}

async function handleReorder(event: CustomEvent<ItemReorderEventDetail>) {
    if (!playlist.value) return;

    // Get the reordered song IDs
    const reorderedSongIds = [...playlist.value.songIds];
    const movedItem = reorderedSongIds.splice(event.detail.from, 1)[0];
    reorderedSongIds.splice(event.detail.to, 0, movedItem);

    // Complete the reorder animation
    event.detail.complete();

    // Save the new order
    try {
        await playlistsStore.reorderSongs(playlist.value.id, reorderedSongIds);
    } catch (error) {
        console.error('Failed to reorder songs:', error);
    }
}

async function saveEdit(data: { name: string; emoji: string }) {
    if (!playlist.value) return;
    try {
        await playlistsStore.updatePlaylist(playlist.value.id, {
            name: data.name,
            emoji: data.emoji,
        });
        showEditModal.value = false;
    } catch (error) {
        console.error('Failed to update playlist:', error);
    }
}

async function removeSong(songId: string) {
    if (!playlist.value) return;
    try {
        await playlistsStore.removeSongFromPlaylist(playlist.value.id, songId);
    } catch (error) {
        console.error('Failed to remove song:', error);
    }
}

async function showSongActions(song: Song) {
    const actionSheet = await actionSheetController.create({
        header: song.titel,
        buttons: [
            {
                text: 'Aus Playlist entfernen',
                role: 'destructive',
                icon: trashOutline,
                handler: () => {
                    removeSong(song.id);
                },
            },
            {
                text: 'Abbrechen',
                role: 'cancel',
            },
        ],
    });
    await actionSheet.present();
}

function navigateToAddSongs() {
    if (!playlist.value) return;
    router.push(`/playlists/${playlist.value.id}/add-songs`);
}

function navigateToSong(songId: string) {
    router.push(`/songs/${songId}`);
}
</script>

<style scoped>
.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 48px 24px;
    text-align: center;
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
    margin: 0 0 16px;
    color: var(--ion-color-medium);
}

.empty-playlist-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    text-align: center;
}

.empty-playlist-state .playlist-icon {
    font-size: 64px;
    color: var(--ion-color-medium);
    margin-bottom: 16px;
}

.empty-playlist-state h2 {
    margin: 0 0 8px;
    color: var(--ion-color-dark);
}

.empty-playlist-state p {
    margin: 0 0 16px;
    color: var(--ion-color-medium);
}

.empty-state .add-button {
    margin-top: 24px;
    --padding-start: 24px;
    --padding-end: 24px;
    --padding-top: 12px;
    --padding-bottom: 12px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0.5px;
}

.empty-state .add-button ion-icon {
    color: white;
    margin-right: 8px;
    font-size: 20px;
}
</style>
