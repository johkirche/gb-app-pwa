<template>
    <div class="relative flex h-full flex-col bg-background">
        <AppPageHeader :title="reorderMode ? 'Reihenfolge ändern' : 'Gottesdienst'">
            <template #trailing>
                <Button
                    v-if="reorderMode"
                    variant="ghost"
                    class="text-primary"
                    @click="reorderMode = false"
                >
                    Fertig
                </Button>
                <DropdownMenu v-else-if="hasSelection">
                    <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" aria-label="Menü">
                            <EllipsisVertical class="!size-5" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem @select="reorderMode = true">
                            <Rows3 />
                            Reihenfolge ändern
                        </DropdownMenuItem>
                        <DropdownMenuItem @select="saveAsPlaylist">
                            <ListMusic />
                            Als Playlist sichern
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" @select="confirmClear">
                            <Trash2 />
                            Auswahl leeren
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col pb-[max(2rem,env(safe-area-inset-bottom))]">
                <!-- Loading State -->
                <div v-if="isLoading" class="flex min-h-[60vh] items-center justify-center">
                    <Spinner size="lg" />
                </div>

                <!-- Nothing marked yet -->
                <div
                    v-else-if="!hasSelection"
                    class="flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center"
                >
                    <Church
                        class="size-14 text-muted-foreground"
                        stroke-width="1.25"
                        aria-hidden="true"
                    />
                    <h2 class="mt-4 font-display text-2xl font-semibold">Nichts vorgemerkt</h2>
                    <p class="mt-2 max-w-96 text-sm leading-relaxed text-muted-foreground">
                        Merken Sie die Lieder dieses Gottesdienstes vor — im Lied selbst oder mit
                        einem langen Druck auf einen Eintrag in der Liederliste. Sie liegen dann
                        hier bereit und verschwinden von allein, wenn der Tag vorbei ist.
                    </p>
                    <div class="mt-6 flex flex-col items-stretch gap-2">
                        <Button @click="router.push('/tabs/lieder')">
                            <Music aria-hidden="true" />
                            Lieder durchsuchen
                        </Button>
                        <Button
                            v-if="hasSources"
                            ref="emptySourceButtonRef"
                            variant="outline"
                            @click="openSourcePanel(emptySourceButtonRef?.$el ?? null)"
                        >
                            <Import aria-hidden="true" />
                            Ablauf übernehmen
                        </Button>
                    </div>
                </div>

                <!-- The service -->
                <template v-else>
                    <header class="pt-6">
                        <p class="label-micro text-gold">Vorgemerkt</p>
                        <h2 class="mt-1.5 break-words font-display text-3xl font-semibold">
                            {{ plan?.title }}
                        </h2>
                        <p class="mt-1.5 text-sm text-muted-foreground">
                            {{ dateLabel }} · {{ countLabel }}
                            <template v-if="originLabel">· {{ originLabel }}</template>
                        </p>
                    </header>

                    <!-- The date is the whole of the expiry: the selection lives
                         until the end of the day it is for, and moving it moves
                         both. -->
                    <div
                        class="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5"
                    >
                        <Label for="service-date" class="flex items-center gap-2.5 font-normal">
                            <CalendarDays
                                class="size-[18px] shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Gilt für
                        </Label>
                        <Input
                            id="service-date"
                            v-model="serviceDate"
                            type="date"
                            :min="today"
                            class="h-9 w-auto shrink-0"
                        />
                    </div>
                    <p class="mt-2 px-1 text-[13px] text-muted-foreground">{{ expiryHint }}</p>

                    <ServiceSongsList
                        :songs="songs"
                        :reorder-mode="reorderMode"
                        @song-click="(song) => router.push(`/songs/${song.id}`)"
                        @song-context-menu="showSongActions"
                        @reorder="handleReorder"
                    />

                    <!-- Songs on the plan whose record is not on this device -->
                    <p v-if="missingCount > 0" class="mt-3 px-2 text-[13px] text-muted-foreground">
                        {{ missingCount }}
                        {{ missingCount === 1 ? 'Lied ist' : 'Lieder sind' }} auf diesem Gerät nicht
                        vorhanden. Synchronisieren Sie das Gesangbuch, um
                        {{ missingCount === 1 ? 'es' : 'sie' }} zu sehen.
                    </p>

                    <div v-if="!reorderMode" class="mt-6 flex flex-wrap gap-2">
                        <Button variant="outline" @click="router.push('/tabs/lieder')">
                            <Plus aria-hidden="true" />
                            Lied vormerken
                        </Button>
                        <Button
                            v-if="hasSources"
                            ref="sourceButtonRef"
                            variant="ghost"
                            @click="openSourcePanel(sourceButtonRef?.$el ?? null)"
                        >
                            <Import aria-hidden="true" />
                            Ablauf übernehmen
                        </Button>
                    </div>
                </template>
            </div>
        </main>

        <!-- Song context menu (long-press / right-click) -->
        <ActionSheet
            v-model:open="songSheetOpen"
            :title="songSheetSong?.titel"
            :actions="songSheetActions"
            :anchor="songSheetAnchor"
        />

        <!-- Ready-made plans on offer (playlists today, the backend later) -->
        <ServiceSourcePanel
            :is-open="sourcePanelOpen"
            :anchor="sourcePanelAnchor"
            @close="sourcePanelOpen = false"
            @select="adoptOffer"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';

import {
    CalendarDays,
    Church,
    EllipsisVertical,
    Import,
    ListMusic,
    Music,
    Plus,
    Rows3,
    Trash2,
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { usePlaylistsStore } from '@/stores/playlists';
import { useServiceStore } from '@/stores/service';
import { useSongsStore } from '@/stores/songs';

import { useConfirm } from '@/composables/useConfirm';

import ServiceSongsList from '@/components/service/ServiceSongsList.vue';
import ServiceSourcePanel from '@/components/service/ServiceSourcePanel.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionSheet, type ActionSheetAction } from '@/components/ui/responsive-panel';
import { Spinner } from '@/components/ui/spinner';

import type { Song } from '@/db';
import type { PanelAnchor } from '@/lib/anchor';
import {
    collectServicePlanOffers,
    formatExpiryHint,
    formatServiceDate,
    todayIsoDate,
} from '@/services/servicePlans';

const router = useRouter();
const { confirm } = useConfirm();
const serviceStore = useServiceStore();
const songsStore = useSongsStore();
const playlistsStore = usePlaylistsStore();

const { plan, isLoading, hasSelection, entryCount } = storeToRefs(serviceStore);
const { songs: allSongs } = storeToRefs(songsStore);

const reorderMode = ref(false);
const today = todayIsoDate();

// The songs on the plan, in the plan's order. Ids without a record on this
// device are counted rather than rendered — the same rule the playlists follow.
const songs = computed<Song[]>(() => {
    const byId = new Map(allSongs.value.map((song) => [song.id, song]));
    return serviceStore.songIds
        .map((id) => byId.get(id))
        .filter((song): song is Song => song !== undefined);
});

const missingCount = computed(() => entryCount.value - songs.value.length);

const countLabel = computed(() =>
    entryCount.value === 1 ? '1 Lied' : `${entryCount.value} Lieder`,
);
const dateLabel = computed(() => (plan.value ? formatServiceDate(plan.value.date) : ''));
const expiryHint = computed(() => (plan.value ? formatExpiryHint(plan.value.date) : ''));
const originLabel = computed(() => {
    const origin = plan.value?.origin;
    if (!origin) return '';
    return origin.label ? `aus „${origin.label}“` : '';
});

const serviceDate = computed<string | number | undefined>({
    get: () => plan.value?.date,
    set: (value) => {
        // A cleared native date field reports '' — keep the day it had.
        if (typeof value === 'string' && value) serviceStore.setDate(value);
    },
});

// Whether anything is on offer at all. Checked here so the "Ablauf übernehmen"
// entry point only appears when a source can actually answer — with no
// playlists and no backend provider registered, it stays out of the way.
const hasSources = ref(false);

async function refreshSources() {
    hasSources.value = (await collectServicePlanOffers()).length > 0;
}

onMounted(refreshSources);

// The page lives inside the kept-alive tab shell, so entering it again is not a
// mount: re-check the expiry (a phone left on overnight never reloads) and the
// offers (a playlist may have been created in the meantime).
onActivated(async () => {
    await serviceStore.pruneIfExpired();
    await refreshSources();
});

async function handleReorder(orderedIds: string[]) {
    try {
        await serviceStore.reorder(orderedIds);
    } catch (err) {
        console.error('Failed to reorder the service selection:', err);
    }
}

async function confirmClear() {
    const ok = await confirm({
        title: 'Auswahl leeren?',
        message: 'Die vorgemerkten Lieder werden entfernt. Ihre Playlists bleiben unberührt.',
        confirmText: 'Leeren',
        destructive: true,
    });
    if (!ok) return;

    await serviceStore.clear();
    reorderMode.value = false;
}

/** Keep a service that worked: the same songs, but permanently. */
async function saveAsPlaylist() {
    if (!plan.value || songs.value.length === 0) return;

    try {
        const name = `${plan.value.title} ${formatShortDate(plan.value.date)}`.trim();
        const playlist = await playlistsStore.createPlaylist(name, '⛪');
        await playlistsStore.addSongsToPlaylist(
            playlist.id,
            songs.value.map((song) => song.id),
        );
        toast.success(`Als Playlist „${playlist.name}“ gesichert`, { duration: 2500 });
    } catch (err) {
        console.error('Failed to save the service as a playlist:', err);
        toast.error('Die Playlist konnte nicht angelegt werden.');
    }
}

function formatShortDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return day && month && year ? `${day}.${month}.${year}` : '';
}

// --- Ready-made plans ---

const sourcePanelOpen = ref(false);
const sourcePanelAnchor = ref<PanelAnchor>(null);
const sourceButtonRef = ref<{ $el?: HTMLElement } | null>(null);
const emptySourceButtonRef = ref<{ $el?: HTMLElement } | null>(null);

function openSourcePanel(anchor: PanelAnchor) {
    sourcePanelAnchor.value = anchor;
    sourcePanelOpen.value = true;
}

async function adoptOffer(providerId: string, offerId: string) {
    if (hasSelection.value) {
        const ok = await confirm({
            title: 'Auswahl ersetzen?',
            message: 'Die bisher vorgemerkten Lieder werden durch den übernommenen Ablauf ersetzt.',
            confirmText: 'Übernehmen',
        });
        if (!ok) return;
    }

    sourcePanelOpen.value = false;
    const adopted = await serviceStore.adoptOffer(providerId, offerId);
    if (adopted) {
        toast.success('Ablauf übernommen', { duration: 2000 });
    } else {
        toast.error('Der Ablauf konnte nicht übernommen werden.');
        await refreshSources();
    }
}

// --- Song context menu ---

const songSheetOpen = ref(false);
const songSheetSong = ref<Song | null>(null);
const songSheetAnchor = ref<PanelAnchor>(null);

const songSheetActions = computed<ActionSheetAction[]>(() => [
    {
        label: 'Aus Gottesdienst entfernen',
        role: 'destructive',
        icon: Trash2,
        handler: () => {
            if (songSheetSong.value) serviceStore.removeSong(songSheetSong.value.id);
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
</script>
