<template>
    <ResponsivePanel
        :open="isOpen"
        :anchor="anchor"
        label="Zu Playlist hinzufügen"
        :snap-points="snapPoints"
        :initial-snap-point="0.5"
        drawer-class="h-full max-h-[97dvh]"
        popover-class="w-80"
        @update:open="onOpenChange"
    >
        <div
            class="sticky top-0 z-20 flex items-center justify-between gap-2 bg-popover py-1 pl-4 pr-2"
        >
            <PanelTitle>Zu Playlist hinzufügen</PanelTitle>
            <Button variant="ghost" class="text-primary" @click="emit('close')">Fertig</Button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center p-12">
            <Spinner size="lg" />
        </div>

        <!-- Empty State -->
        <div
            v-else-if="!hasPlaylists"
            class="flex flex-col items-center justify-center px-6 py-12 text-center"
        >
            <Library class="size-12 text-muted-foreground" stroke-width="1.5" aria-hidden="true" />
            <p class="mt-3 text-muted-foreground">Keine Playlisten vorhanden</p>
            <Button class="mt-4" @click="navigateToCreate">
                <Plus aria-hidden="true" />
                Playlist erstellen
            </Button>
        </div>

        <!-- Playlists List -->
        <div v-else class="px-4 pb-6">
            <!-- Create New Option -->
            <button
                type="button"
                class="flex w-full items-center gap-3 rounded-sm py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                @click.stop="navigateToCreate"
            >
                <CirclePlus class="size-6 shrink-0 text-primary" aria-hidden="true" />
                <span class="min-w-0 flex-1 text-[15px] font-medium text-primary">
                    Neue Playlist erstellen
                </span>
                <ChevronRight class="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            </button>

            <div class="mt-1 flex items-center gap-3">
                <span class="label-micro shrink-0 text-gold">Playlisten</span>
                <Separator class="flex-1" />
            </div>

            <!-- Existing Playlists -->
            <ul class="mt-1 divide-y divide-border">
                <li v-for="playlist in sortedPlaylists" :key="playlist.id">
                    <button
                        type="button"
                        class="flex w-full items-center gap-3 rounded-sm py-2.5 text-left transition-colors hover:bg-muted active:bg-muted disabled:pointer-events-none disabled:opacity-50"
                        :disabled="isSongInPlaylist(playlist.id)"
                        @click="addToPlaylist(playlist.id)"
                    >
                        <span
                            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-xl leading-none"
                        >
                            {{ playlist.emoji }}
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block break-words text-[15px] font-medium leading-tight">
                                {{ playlist.name }}
                            </span>
                            <span class="mt-0.5 block text-sm text-muted-foreground">
                                {{ playlist.songIds.length }}
                                {{ playlist.songIds.length === 1 ? 'Lied' : 'Lieder' }}
                            </span>
                        </span>
                        <CircleCheck
                            v-if="
                                isSongInPlaylist(playlist.id) || addedToPlaylistId === playlist.id
                            "
                            class="size-5 shrink-0 text-green-600 dark:text-green-500"
                            aria-hidden="true"
                        />
                    </button>
                </li>
            </ul>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { ChevronRight, CircleCheck, CirclePlus, Library, Plus } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { usePlaylistsStore } from '@/stores/playlists';

import { Button } from '@/components/ui/button';
import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

import type { PanelAnchor } from '@/lib/anchor';

const props = defineProps<{
    isOpen: boolean;
    songId: string;
    /** What the desktop popover opens against — the control that opened it. */
    anchor?: PanelAnchor;
}>();

const emit = defineEmits<{
    close: [];
    added: [playlistId: string];
}>();

const router = useRouter();
const playlistsStore = usePlaylistsStore();
const { isLoading, hasPlaylists, sortedPlaylists } = storeToRefs(playlistsStore);

// Sheet snap points (Ionic breakpoints [0, 0.5, 0.75, 1]: drag past the lowest point dismisses)
const snapPoints = [0.5, 0.75, 1];

// Track which playlist was just added to (for visual feedback)
const addedToPlaylistId = ref<string | null>(null);

function onOpenChange(open: boolean) {
    if (!open) emit('close');
}

function isSongInPlaylist(playlistId: string): boolean {
    const playlist = playlistsStore.getPlaylistById(playlistId);
    return playlist?.songIds.includes(props.songId) ?? false;
}

async function addToPlaylist(playlistId: string) {
    if (isSongInPlaylist(playlistId)) return;

    try {
        await playlistsStore.addSongToPlaylist(playlistId, props.songId);
        addedToPlaylistId.value = playlistId;
        emit('added', playlistId);

        // Auto-close after a short delay
        setTimeout(() => {
            emit('close');
            addedToPlaylistId.value = null;
        }, 500);
    } catch (error) {
        console.error('Failed to add song to playlist:', error);
    }
}

function navigateToCreate() {
    const returnPath = router.currentRoute.value.fullPath;
    const songId = props.songId;

    emit('close');

    // Small delay to ensure the sheet dismisses properly on mobile before navigation
    setTimeout(() => {
        router.push({
            path: '/playlists/create',
            query: {
                returnTo: returnPath,
                addSongId: songId,
            },
        });
    }, 100);
}
</script>
