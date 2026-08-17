<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button default-href="/tabs/playlisten" text=""></ion-back-button>
                </ion-buttons>
                <ion-title>Neue Playlist</ion-title>
                <ion-buttons slot="end">
                    <ion-button :disabled="!isValid" @click="createPlaylist">
                        <ion-icon slot="icon-only" :icon="checkmarkOutline"></ion-icon>
                    </ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true" class="ion-padding">
            <div class="create-form">
                <!-- Emoji Picker -->
                <div class="emoji-section">
                    <button class="emoji-display" @click="showEmojiPicker = true">
                        {{ selectedEmoji }}
                    </button>
                    <p class="emoji-hint">Tippen zum Ändern</p>
                </div>

                <!-- Name Input -->
                <ion-input
                    v-model="playlistName"
                    label="Name der Playlist"
                    label-placement="stacked"
                    placeholder="z.B. Sonntagsgottesdienst"
                    fill="outline"
                    :clear-input="true"
                    @keyup.enter="createPlaylist"
                ></ion-input>

                <!-- Create Button (for visibility on mobile) -->
                <ion-button
                    expand="block"
                    class="create-button"
                    :disabled="!isValid"
                    @click="createPlaylist"
                >
                    <ion-icon slot="start" :icon="addOutline"></ion-icon>
                    Playlist erstellen
                </ion-button>
            </div>

            <!-- Emoji Picker Modal -->
            <ion-modal :is-open="showEmojiPicker" @didDismiss="showEmojiPicker = false">
                <ion-header>
                    <ion-toolbar>
                        <ion-title>Emoji wählen</ion-title>
                        <ion-buttons slot="end">
                            <ion-button @click="showEmojiPicker = false">Fertig</ion-button>
                        </ion-buttons>
                    </ion-toolbar>
                </ion-header>
                <ion-content class="ion-padding">
                    <div class="emoji-grid">
                        <button
                            v-for="emoji in commonEmojis"
                            :key="emoji"
                            class="emoji-option"
                            :class="{ selected: emoji === selectedEmoji }"
                            @click="selectEmoji(emoji)"
                        >
                            {{ emoji }}
                        </button>
                    </div>
                </ion-content>
            </ion-modal>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonModal,
    IonPage,
    IonTitle,
    IonToolbar,
    toastController,
} from '@ionic/vue';
import { addOutline, checkmarkOutline } from 'ionicons/icons';
import { useRoute } from 'vue-router';
import { useRouter } from 'vue-router';

import { usePlaylistsStore } from '@/stores/playlists';

const router = useRouter();
const route = useRoute();
const playlistsStore = usePlaylistsStore();

// Query params for return-to-modal flow
const returnTo = computed(() => route.query.returnTo as string | undefined);
const addSongId = computed(() => route.query.addSongId as string | undefined);

const playlistName = ref('');
const selectedEmoji = ref('🎵');
const showEmojiPicker = ref(false);

// Common emojis for playlists
const commonEmojis = [
    '🎵',
    '🎶',
    '🎼',
    '🎹',
    '🎸',
    '🎺',
    '🎻',
    '🥁',
    '🎤',
    '🎧',
    '🎭',
    '⛪',
    '✝️',
    '🙏',
    '💒',
    '📖',
    '📿',
    '🕊️',
    '👼',
    '😇',
    '🌟',
    '⭐',
    '✨',
    '💫',
    '🌈',
    '🌸',
    '🌺',
    '🌻',
    '🌹',
    '💐',
    '❤️',
    '💙',
    '💚',
    '💛',
    '💜',
    '🤍',
    '☀️',
    '🌙',
    '🕯️',
    '🔔',
    '🎄',
    '🐣',
    '🎃',
    '🍂',
    '❄️',
    '🎉',
    '🎊',
    '👨‍👩‍👧‍👦',
    '👶',
    '👧',
    '👦',
    '🧒',
    '👴',
    '👵',
    '🤝',
    '💪',
    '🏃',
    '🧘',
    '📅',
    '📌',
    '🏠',
    '🌍',
];

const isValid = computed(() => playlistName.value.trim().length > 0);

function selectEmoji(emoji: string) {
    selectedEmoji.value = emoji;
    showEmojiPicker.value = false;
}

async function createPlaylist() {
    if (!isValid.value) return;

    try {
        const playlist = await playlistsStore.createPlaylist(
            playlistName.value.trim(),
            selectedEmoji.value,
        );

        // If we came from the playlist select modal, add the song and go back
        if (returnTo.value && addSongId.value) {
            await playlistsStore.addSongToPlaylist(playlist.id, addSongId.value);

            // Show success toast
            const toast = await toastController.create({
                message: `Lied zu "${playlist.name}" hinzugefügt`,
                duration: 2500,
                position: 'bottom',
                color: 'success',
            });
            await toast.present();

            router.replace(returnTo.value);
        } else {
            // Navigate to the new playlist
            router.replace(`/playlists/${playlist.id}`);
        }
    } catch (error) {
        console.error('Failed to create playlist:', error);
    }
}

// randomize the selected emoji on load
selectedEmoji.value = commonEmojis[Math.floor(Math.random() * commonEmojis.length)];
</script>

<style scoped>
.create-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 24px);
    max-width: 400px;
    margin: 0 auto;
    padding-top: var(--spacing-lg, 24px);
}

.emoji-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs, 8px);
}

.emoji-display {
    font-size: 4rem;
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ion-color-light);
    border: 2px solid var(--ion-color-medium);
    border-radius: 20px;
    cursor: pointer;
    transition: transform 0.15s ease;
}

.emoji-display:hover {
    transform: scale(1.05);
}

.emoji-display:active {
    transform: scale(0.95);
}

.emoji-hint {
    font-size: 0.85rem;
    color: var(--ion-color-medium);
    margin: 0;
}

.create-button {
    margin-top: var(--spacing-md, 16px);
}

.emoji-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    gap: 8px;
}

.emoji-option {
    font-size: 1.75rem;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ion-color-light);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.emoji-option:hover {
    background: var(--ion-color-light-shade);
}

.emoji-option.selected {
    border-color: var(--ion-color-primary);
    background: var(--ion-color-primary-tint);
}
</style>
