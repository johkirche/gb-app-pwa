<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Neue Playlist">
            <template #leading>
                <BackButton default-href="/tabs/playlisten" />
            </template>
            <template #trailing>
                <Button
                    variant="ghost"
                    size="icon"
                    :disabled="!isValid"
                    aria-label="Playlist erstellen"
                    @click="createPlaylist"
                >
                    <Check class="!size-5" aria-hidden="true" />
                </Button>
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-8 pt-6">
                <!-- Emoji Picker -->
                <div class="flex flex-col items-center gap-2">
                    <button
                        type="button"
                        class="flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-muted text-6xl leading-none transition-transform hover:scale-105 active:scale-95"
                        @click="showEmojiPicker = true"
                    >
                        {{ selectedEmoji }}
                    </button>
                    <p class="text-sm text-muted-foreground">Tippen zum Ändern</p>
                </div>

                <!-- Name Input -->
                <div class="space-y-2">
                    <Label for="create-playlist-name">Name der Playlist</Label>
                    <div class="relative">
                        <Input
                            id="create-playlist-name"
                            v-model="playlistName"
                            placeholder="z.B. Sonntagsgottesdienst"
                            class="pr-10"
                            @keyup.enter="createPlaylist"
                        />
                        <button
                            v-if="playlistName"
                            type="button"
                            class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Eingabe löschen"
                            @click="playlistName = ''"
                        >
                            <X class="size-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <!-- Create Button (for visibility on mobile) -->
                <Button class="mt-4 w-full" size="lg" :disabled="!isValid" @click="createPlaylist">
                    <Plus aria-hidden="true" />
                    Playlist erstellen
                </Button>
            </div>
        </main>

        <!-- Emoji Picker Modal -->
        <EmojiPicker
            :is-open="showEmojiPicker"
            :selected-emoji="selectedEmoji"
            @close="showEmojiPicker = false"
            @select="selectEmoji"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Check, Plus, X } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { usePlaylistsStore } from '@/stores/playlists';

import EmojiPicker, { PLAYLIST_EMOJIS } from '@/components/playlist/EmojiPicker.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const router = useRouter();
const route = useRoute();
const playlistsStore = usePlaylistsStore();

// Query params for return-to-modal flow
const returnTo = computed(() => route.query.returnTo as string | undefined);
const addSongId = computed(() => route.query.addSongId as string | undefined);

const playlistName = ref('');
// Randomize the initial emoji on load (intentional)
const selectedEmoji = ref(PLAYLIST_EMOJIS[Math.floor(Math.random() * PLAYLIST_EMOJIS.length)]);
const showEmojiPicker = ref(false);

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
            toast.success(`Lied zu "${playlist.name}" hinzugefügt`, { duration: 2500 });

            router.replace(returnTo.value);
        } else {
            // Navigate to the new playlist
            router.replace(`/playlists/${playlist.id}`);
        }
    } catch (error) {
        console.error('Failed to create playlist:', error);
    }
}
</script>
