<template>
    <!-- Selected verses into the hymnal's own lists: as a reading for the
         Gottesdienst, or as passages in a playlist. -->
    <BibelVerseAction :icon="Church" label="Gottesdienst" @click="toService" />

    <DropdownMenu v-if="playlistsStore.sortedPlaylists.length > 0">
        <DropdownMenuTrigger as-child>
            <BibelVerseAction :icon="ListMusic" label="Playlist" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" class="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuItem
                v-for="playlist in playlistsStore.sortedPlaylists"
                :key="playlist.id"
                @select="toPlaylist(playlist.id, playlist.name)"
            >
                <span aria-hidden="true">{{ playlist.emoji }}</span>
                <span class="truncate">{{ playlist.name }}</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Church, ListMusic } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

import { usePlaylistsStore } from '@/stores/playlists';
import { useServiceStore } from '@/stores/service';

import BibelVerseAction from '@/components/bibel/BibelVerseAction.vue';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { BibelPassage } from '@/db';
import type { ChapterRef } from '@/utils/bibel';
import { passagesFromVerses } from '@/utils/bibelPassage';

const props = defineProps<{
    here: ChapterRef;
    /** The selected verses, sorted. */
    verses: number[];
    label: string;
    done: () => void;
}>();

const serviceStore = useServiceStore();
const playlistsStore = usePlaylistsStore();

const passages = computed<BibelPassage[]>(() => passagesFromVerses(props.here, props.verses));

async function toService() {
    try {
        for (const passage of passages.value) await serviceStore.addLesung(passage);
        toast.success(`Als Lesung vorgemerkt: ${props.label}`, { duration: 2000 });
        props.done();
    } catch (err) {
        console.error('Error adding the reading:', err);
        toast.error('Die Lesung konnte nicht gespeichert werden.');
    }
}

async function toPlaylist(id: string, name: string) {
    try {
        await playlistsStore.addPassagesToPlaylist(id, passages.value);
        toast.success(`${props.label} zu „${name}" hinzugefügt`, { duration: 2000 });
        props.done();
    } catch (err) {
        console.error('Error adding the passage to the playlist:', err);
        toast.error('Die Bibelstelle konnte nicht gespeichert werden.');
    }
}
</script>
