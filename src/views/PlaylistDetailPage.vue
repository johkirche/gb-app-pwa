<template>
    <div class="relative flex h-full flex-col bg-background">
        <AppPageHeader :title="reorderMode ? 'Reihenfolge ändern' : playlist?.name || 'Playlist'">
            <template #leading>
                <BackButton default-href="/tabs/playlisten" />
            </template>
            <template #trailing>
                <Button
                    v-if="reorderMode"
                    variant="ghost"
                    class="text-primary"
                    @click="toggleReorderMode"
                >
                    Fertig
                </Button>
                <DropdownMenu v-else>
                    <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" aria-label="Menü">
                            <EllipsisVertical class="!size-5" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem @select="toggleReorderMode">
                            <Rows3 />
                            Reihenfolge ändern
                        </DropdownMenuItem>
                        <DropdownMenuItem @select="openEditModal">
                            <Pencil />
                            Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem :disabled="songs.length === 0" @select="adoptAsService">
                            <Church />
                            Als Gottesdienst übernehmen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" @select="confirmDelete">
                            <Trash2 />
                            Löschen
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col pb-28">
                <!-- Loading State -->
                <div v-if="isLoading" class="flex min-h-[60vh] items-center justify-center">
                    <Spinner size="lg" />
                </div>

                <!-- Playlist Not Found -->
                <div
                    v-else-if="!playlist"
                    class="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center"
                >
                    <CircleAlert
                        class="size-14 text-muted-foreground"
                        stroke-width="1.25"
                        aria-hidden="true"
                    />
                    <h2 class="mt-4 font-display text-2xl font-semibold">
                        Playlist nicht gefunden
                    </h2>
                    <Button class="mt-6" @click="router.push('/tabs/playlisten')">
                        Zurück zu Playlisten
                    </Button>
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
                    <div
                        v-if="songs.length === 0"
                        class="flex flex-col items-center px-6 py-12 text-center"
                    >
                        <Music
                            class="size-14 text-muted-foreground"
                            stroke-width="1.25"
                            aria-hidden="true"
                        />
                        <h2 class="mt-4 font-display text-2xl font-semibold">Keine Lieder</h2>
                        <p class="mt-2 max-w-xs text-sm text-muted-foreground">
                            Fügen Sie Lieder zu dieser Playlist hinzu.
                        </p>
                        <Button class="mt-6" @click="navigateToAddSongs">
                            <Plus aria-hidden="true" />
                            Lieder hinzufügen
                        </Button>
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
                </template>
            </div>
        </main>

        <!-- FAB for adding songs -->
        <Button
            v-if="!isLoading && playlist && songs.length > 0"
            size="icon"
            class="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-10 h-14 w-14 rounded-full shadow-lg"
            aria-label="Lieder hinzufügen"
            @click="navigateToAddSongs"
        >
            <Plus class="!size-6" aria-hidden="true" />
        </Button>

        <!-- Song context menu (long-press / right-click) -->
        <ActionSheet
            v-model:open="songSheetOpen"
            :title="songSheetSong?.titel"
            :actions="songSheetActions"
            :anchor="songSheetAnchor"
        />

        <!-- Edit Modal -->
        <PlaylistEditModal
            :is-open="showEditModal"
            :name="playlist?.name || ''"
            :emoji="playlist?.emoji || '🎵'"
            @close="showEditModal = false"
            @save="saveEdit"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import {
    Church,
    CircleAlert,
    EllipsisVertical,
    Music,
    Pencil,
    Plus,
    Rows3,
    Trash2,
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { usePlaylistsStore } from '@/stores/playlists';
import { useServiceStore } from '@/stores/service';
import { useSongsStore } from '@/stores/songs';

import { useConfirm } from '@/composables/useConfirm';

import PlaylistEditModal from '@/components/playlist/PlaylistEditModal.vue';
import PlaylistHeader from '@/components/playlist/PlaylistHeader.vue';
import PlaylistSongsList from '@/components/playlist/PlaylistSongsList.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActionSheet, type ActionSheetAction } from '@/components/ui/responsive-panel';
import { Spinner } from '@/components/ui/spinner';

import type { Song } from '@/db';
import type { PanelAnchor } from '@/lib/anchor';

const route = useRoute();
const router = useRouter();
const playlistsStore = usePlaylistsStore();
const songsStore = useSongsStore();
const serviceStore = useServiceStore();
const { confirm } = useConfirm();

const { isLoading } = storeToRefs(playlistsStore);
const { songs: allSongs } = storeToRefs(songsStore);

// UI State
const showEditModal = ref(false);
const reorderMode = ref(false);

// Get current playlist
const playlist = computed(() => {
    const id = route.params.id as string;
    return playlistsStore.getPlaylistById(id);
});

// Get songs in playlist (ids without a matching song are not rendered)
const songs = computed<Song[]>(() => {
    if (!playlist.value) return [];
    return playlist.value.songIds
        .map((id) => allSongs.value.find((s) => s.id === id))
        .filter((s): s is Song => s !== undefined);
});

function openEditModal() {
    // Let the dropdown menu finish closing before opening the dialog
    nextTick(() => {
        showEditModal.value = true;
    });
}

async function confirmDelete() {
    await nextTick();
    const ok = await confirm({
        title: 'Playlist löschen?',
        message: `Möchten Sie die Playlist '${playlist.value?.name}' wirklich löschen?`,
        confirmText: 'Löschen',
        destructive: true,
    });
    if (ok) {
        await deletePlaylist();
    }
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

/**
 * Run this playlist as today's service. It goes through the playlist provider
 * rather than copying the ids here, so a plan adopted from the backend later
 * arrives on exactly the same path.
 */
async function adoptAsService() {
    if (!playlist.value || songs.value.length === 0) return;
    await nextTick();

    if (serviceStore.hasSelection) {
        const ok = await confirm({
            title: 'Auswahl ersetzen?',
            message: 'Die bisher vorgemerkten Lieder werden durch diese Playlist ersetzt.',
            confirmText: 'Übernehmen',
        });
        if (!ok) return;
    }

    const adopted = await serviceStore.adoptOffer('playlist', playlist.value.id);
    if (!adopted) {
        toast.error('Die Playlist konnte nicht übernommen werden.');
        return;
    }

    toast.success('Als Gottesdienst übernommen', { duration: 2000 });
    router.push('/tabs/gottesdienst');
}

function toggleReorderMode() {
    reorderMode.value = !reorderMode.value;
}

/**
 * Persist a new song order. `orderedIds` is the complete reordered list of the
 * *rendered* songs; ids whose song is missing locally (filtered from display)
 * are appended so they are not dropped from the playlist. This replaces the old
 * rendered-index-into-raw-ids splice, which misaligned when ids were filtered.
 */
async function handleReorder(orderedIds: string[]) {
    if (!playlist.value) return;

    const orderedSet = new Set(orderedIds);
    const hiddenIds = playlist.value.songIds.filter((id) => !orderedSet.has(id));

    try {
        await playlistsStore.reorderSongs(playlist.value.id, [...orderedIds, ...hiddenIds]);
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

// Song context menu — guarded so long-press AND contextmenu (both fire on some
// Android browsers) cannot open the sheet twice
const songSheetOpen = ref(false);
const songSheetSong = ref<Song | null>(null);
// The row (or click point) the desktop popover form hangs off
const songSheetAnchor = ref<PanelAnchor>(null);

const songSheetActions = computed<ActionSheetAction[]>(() => [
    {
        label: 'Aus Playlist entfernen',
        role: 'destructive',
        icon: Trash2,
        handler: () => {
            if (songSheetSong.value) {
                removeSong(songSheetSong.value.id);
            }
        },
    },
    {
        label: 'Abbrechen',
        role: 'cancel',
    },
]);

function showSongActions(song: Song, anchor: PanelAnchor) {
    if (songSheetOpen.value) return;
    songSheetSong.value = song;
    songSheetAnchor.value = anchor;
    songSheetOpen.value = true;
}

function navigateToAddSongs() {
    if (!playlist.value) return;
    router.push(`/playlists/${playlist.value.id}/add-songs`);
}

function navigateToSong(songId: string) {
    router.push(`/songs/${songId}`);
}
</script>
