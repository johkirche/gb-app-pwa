<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button default-href="/tabs/playlisten" text=""></ion-back-button>
                </ion-buttons>
                <ion-title>Favoriten</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true">
            <!-- Empty state -->
            <div v-if="favoritedSongs.length === 0" class="state-container empty-state">
                <ion-icon :icon="heartOutline" size="large"></ion-icon>
                <h2>Keine Favoriten</h2>
                <p>
                    Tippe auf das Herz-Symbol in einem Lied, um es zu deinen Favoriten hinzuzufügen.
                </p>
                <ion-button fill="outline" @click="router.push('/tabs/lieder')">
                    Lieder durchsuchen
                </ion-button>
            </div>

            <!-- Favorites list -->
            <ion-list v-else>
                <ion-item
                    v-for="song in favoritedSongs"
                    :key="song.id"
                    button
                    detail
                    @click="navigateToSong(song.id)"
                >
                    <ion-label>
                        <h2>
                            <span v-if="song.index" class="song-index">{{ song.index }}.</span>
                            <span class="song-title-text">{{ song.titel }}</span>
                        </h2>
                        <p v-if="formatCategories(song.kategorien)">
                            {{ formatCategories(song.kategorien) }}
                        </p>
                    </ion-label>
                    <ion-button
                        slot="end"
                        fill="clear"
                        color="danger"
                        :aria-label="`${song.titel} aus Favoriten entfernen`"
                        @click.stop="removeFavorite(song.id)"
                    >
                        <ion-icon slot="icon-only" :icon="heart"></ion-icon>
                    </ion-button>
                </ion-item>
            </ion-list>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonTitle,
    IonToolbar,
} from '@ionic/vue';
import { heart, heartOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';

import { useFavoritesStore } from '@/stores/favorites';
import { useSongsStore } from '@/stores/songs';

import type { Category } from '@/db';

const router = useRouter();
const songsStore = useSongsStore();
const favoritesStore = useFavoritesStore();

// Favorited songs, in the order they were added (newest first)
const favoritedSongs = computed(() => {
    const songById = new Map(songsStore.songs.map((s) => [s.id, s]));
    return favoritesStore.sortedFavorites
        .map((f) => songById.get(f.id))
        .filter((s): s is NonNullable<typeof s> => !!s);
});

function navigateToSong(id: string) {
    router.push(`/songs/${id}`);
}

function removeFavorite(id: string) {
    favoritesStore.removeFavorite(id);
}

function formatCategories(categories: Category[]): string {
    return categories
        .map((c) => c.name?.trim())
        .filter((name): name is string => !!name)
        .join(', ');
}
</script>

<style scoped>
.song-index {
    font-weight: 600;
    color: var(--ion-color-primary);
    margin-right: 4px;
}

.song-title-text {
    overflow-wrap: break-word;
    word-break: break-word;
}

.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-lg);
    text-align: center;
    gap: var(--spacing-sm);
}

.state-container > ion-icon {
    font-size: 64px;
    color: var(--ion-color-medium);
    margin-bottom: var(--spacing-sm);
}

.state-container h2 {
    margin: 0;
    color: var(--ion-color-dark);
}

.state-container p {
    margin: 0 0 var(--spacing-md);
    color: var(--ion-color-medium);
    max-width: 24rem;
}
</style>
