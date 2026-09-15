<template>
    <Popover v-model:open="menuOpen">
        <PopoverTrigger as-child>
            <Button ref="menuTriggerRef" variant="ghost" size="icon" aria-label="Einstellungen">
                <Settings class="!size-5" aria-hidden="true" />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            align="end"
            :collision-padding="12"
            class="w-80 p-0"
            aria-label="Einstellungen"
        >
            <div class="max-h-[70vh] overflow-y-auto p-3">
                <!-- Actions Group -->
                <p class="label-micro px-1 pb-2 pt-1 text-gold">Aktionen</p>
                <!-- Marking a song and saying which of its verses are sung
                     are one act, so they are one entry: it opens the
                     Strophenwahl, which does the marking when it is saved.
                     Once the song is on the plan the same entry is how the
                     choice is changed, and removing it becomes its own row. -->
                <button
                    v-if="!isInService || canChooseVerses"
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                    @click="handleMarkForService"
                >
                    <component
                        :is="isInService ? ListOrdered : Church"
                        class="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    {{ isInService ? serviceVersesLabel : 'Für Gottesdienst vormerken' }}
                </button>
                <button
                    v-if="isInService"
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                    @click="handleRemoveFromService"
                >
                    <Church class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    Aus Gottesdienst entfernen
                </button>
                <button
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                    @click="handleAddToPlaylist"
                >
                    <ListMusic class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    Zu Playlist hinzufügen
                </button>
                <!-- On a phone this is where sharing lives; from desktop width
                     up the header carries its own share button, so the entry
                     steps back rather than offer the same thing twice. -->
                <button
                    v-if="song"
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted lg:hidden"
                    @click="handleShare"
                >
                    <Share2 class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    Lied teilen
                </button>

                <!-- Display Settings Group -->
                <p class="label-micro mt-3 border-t border-border px-1 pb-2 pt-3 text-gold">
                    Anzeige
                </p>
                <div class="space-y-4 px-1 py-1">
                    <!-- One size for the page. Noten and Text were two controls
                         over one thing: the verses are set at the size of the
                         lyrics under the notes, so moving them apart only pulled
                         the page out of proportion. -->
                    <div class="space-y-3 pb-1">
                        <div class="flex items-baseline justify-between gap-3">
                            <span class="flex items-center gap-2.5 text-sm font-medium">
                                <Type
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                Größe
                            </span>
                            <span class="number-display text-lg leading-none">
                                {{ Math.round(pageScale * 100) }}%
                            </span>
                        </div>
                        <!-- Emits continuously while dragging (like ionInput
                             before) — the notation re-renders live per change. -->
                        <Slider
                            :model-value="[pageScale]"
                            :min="0.5"
                            :max="2"
                            :step="0.1"
                            aria-label="Größe"
                            @update:model-value="onScaleChange"
                        />
                    </div>
                    <div class="flex items-center justify-between gap-3">
                        <Label for="song-show-controls" class="flex items-center gap-2.5">
                            <Music
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Steuerung anzeigen
                        </Label>
                        <Switch
                            id="song-show-controls"
                            :model-value="showControls"
                            @update:model-value="$emit('update:showControls', $event)"
                        />
                    </div>
                    <!-- Hidden where the platform has no wake lock: a switch
                         that provably does nothing is worse than no switch. -->
                    <div v-if="wakeLockSupported" class="flex items-center justify-between gap-3">
                        <Label for="song-keep-awake" class="flex items-center gap-2.5">
                            <Lightbulb
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Bildschirm anlassen
                        </Label>
                        <Switch
                            id="song-keep-awake"
                            :model-value="keepScreenAwake"
                            @update:model-value="$emit('update:keepScreenAwake', $event)"
                        />
                    </div>
                </div>

                <!-- The re-set notation's own settings, offered only while
                     it is what is on screen. Under the fit width the melody is
                     the book's engraving, where neither of these changes
                     anything — and a switch that provably does nothing is worse
                     than no switch. -->
                <template v-if="showsReflow && xmlSettings">
                    <p class="label-micro mt-3 border-t border-border px-1 pb-2 pt-3 text-gold">
                        Neu gesetzte Noten
                    </p>
                    <div class="space-y-4 px-1 py-1">
                        <div class="flex items-center justify-between gap-3">
                            <Label for="song-measure-numbers" class="flex items-center gap-2.5">
                                <List
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                Taktnummern
                            </Label>
                            <Switch
                                id="song-measure-numbers"
                                :model-value="xmlSettings.showMeasureNumbers"
                                @update:model-value="
                                    $emit('update:xmlSetting', {
                                        key: 'showMeasureNumbers',
                                        value: $event,
                                    })
                                "
                            />
                        </div>
                        <div class="flex items-center justify-between gap-3">
                            <Label for="song-show-lyrics" class="flex items-center gap-2.5">
                                <Type
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                Liedtext unter Noten
                            </Label>
                            <Switch
                                id="song-show-lyrics"
                                :model-value="xmlSettings.showLyrics"
                                @update:model-value="
                                    $emit('update:xmlSetting', {
                                        key: 'showLyrics',
                                        value: $event,
                                    })
                                "
                            />
                        </div>
                    </div>
                </template>
            </div>
        </PopoverContent>
    </Popover>

    <!-- Which verses this service sings -->
    <ServiceVersePanel
        :is-open="showVersePanel"
        :song="song ?? null"
        :anchor="menuAnchor"
        @close="showVersePanel = false"
    />

    <!-- Playlist Select Modal -->
    <PlaylistSelectModal
        :is-open="showPlaylistModal"
        :song-id="songId"
        :anchor="menuAnchor"
        @close="showPlaylistModal = false"
        @added="onSongAddedToPlaylist"
    />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import {
    Church,
    Lightbulb,
    List,
    ListMusic,
    ListOrdered,
    Music,
    Settings,
    Share2,
    Type,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';

import { useServiceStore } from '@/stores/service';

import { shareSong } from '@/composables/useShareSong';
import { isWakeLockSupported } from '@/composables/useWakeLock';

import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue';
import ServiceVersePanel from '@/components/service/ServiceVersePanel.vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import type { Song, XmlDisplaySettings } from '@/db';
import type { PanelAnchor } from '@/lib/anchor';
import { formatVerseNumbers } from '@/services/servicePlans';

const props = defineProps<{
    songId: string;
    /**
     * The open hymn. Only the Strophenwahl needs it — everything else here is
     * about the page, not the song — so it stays optional and the entry falls
     * back to marking the whole hymn without it.
     */
    song?: Song | null;
    showControls: boolean;
    /** Whether the re-set notation is the one on screen */
    showsReflow: boolean;
    pageScale: number;
    xmlSettings?: XmlDisplaySettings;
    keepScreenAwake: boolean;
}>();

const emit = defineEmits<{
    'update:showControls': [value: boolean];
    'update:keepScreenAwake': [value: boolean];
    'update:pageScale': [value: number];
    'update:xmlSetting': [
        payload: {
            key: keyof XmlDisplaySettings;
            value: XmlDisplaySettings[keyof XmlDisplaySettings];
        },
    ];
}>();

const serviceStore = useServiceStore();
const isInService = computed(() => serviceStore.isInPlan(props.songId));

// A hymn of one verse has nothing to choose; marking it opens no panel, and
// the entry that would change the choice is not offered either.
const verseCount = computed(() => props.song?.strophen?.length ?? 0);
const canChooseVerses = computed(() => verseCount.value > 1);

/** The entry's label once the song is on the plan: what it currently sings. */
const serviceVersesLabel = computed(() => {
    const selection = serviceStore.versesFor(props.songId);
    return selection ? `Strophen wählen · ${formatVerseNumbers(selection)}` : 'Strophen wählen';
});

const wakeLockSupported = isWakeLockSupported();

const menuOpen = ref(false);
const showPlaylistModal = ref(false);
const showVersePanel = ref(false);

// Marking from inside the song is the fastest path during a service, so the
// menu gets out of the way again straight after. Where there are verses to
// choose the Strophenwahl takes over from here and confirms it itself.
async function handleMarkForService() {
    menuOpen.value = false;

    if (canChooseVerses.value) {
        // Let the popover's focus trap release before the panel takes over.
        await nextTick();
        showVersePanel.value = true;
        return;
    }

    try {
        await serviceStore.markSong(props.songId);
        toast.success('Für den Gottesdienst vorgemerkt', { duration: 2000 });
    } catch (err) {
        console.error('Failed to update the service selection:', err);
        toast.error('Die Auswahl konnte nicht gespeichert werden.');
    }
}

async function handleRemoveFromService() {
    menuOpen.value = false;
    try {
        await serviceStore.removeSong(props.songId);
        toast.success('Aus dem Gottesdienst entfernt', { duration: 2000 });
    } catch (err) {
        console.error('Failed to update the service selection:', err);
        toast.error('Die Auswahl konnte nicht gespeichert werden.');
    }
}

function onScaleChange(value: number[] | undefined) {
    if (value && typeof value[0] === 'number') {
        emit('update:pageScale', value[0]);
    }
}

// The playlist panel replaces this menu, so on desktop it opens off the same
// settings button the menu itself hangs from.
const menuTriggerRef = ref<{ $el?: HTMLElement } | null>(null);
const menuAnchor = computed<PanelAnchor>(() => menuTriggerRef.value?.$el ?? null);

function handleShare() {
    if (!props.song) return;
    menuOpen.value = false;
    void shareSong(props.song);
}

async function handleAddToPlaylist() {
    // Close the popover first, then open the playlist modal — the popover's
    // focus trap must release before the dialog takes over.
    menuOpen.value = false;
    await nextTick();
    showPlaylistModal.value = true;
}

function onSongAddedToPlaylist(_playlistId: string) {
    // Could show a toast notification here
    showPlaylistModal.value = false;
}
</script>
