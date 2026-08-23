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
                <button
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                    @click="handleToggleService"
                >
                    <Church class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {{ isInService ? 'Aus Gottesdienst entfernen' : 'Für Gottesdienst vormerken' }}
                </button>
                <button
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                    @click="handleAddToPlaylist"
                >
                    <ListMusic class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    Zu Playlist hinzufügen
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

                <!-- Melody Settings Group (only shown when relevant) -->
                <template v-if="hasMelodyImage || hasMelodyXml">
                    <p class="label-micro mt-3 border-t border-border px-1 pb-2 pt-3 text-gold">
                        Noten
                    </p>
                    <div class="space-y-4 px-1 py-1">
                        <div class="flex items-center justify-between gap-3">
                            <Label for="song-display-mode" class="flex items-center gap-2.5">
                                <ImageIcon
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                Notenansicht
                            </Label>
                            <Select
                                :model-value="melodyDisplayMode"
                                @update:model-value="onDisplayModeChange"
                            >
                                <SelectTrigger id="song-display-mode" class="h-9 w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="image" :disabled="!hasMelodyImage">
                                        Notenbild
                                    </SelectItem>
                                    <SelectItem value="xml" :disabled="!hasMelodyXml">
                                        MusicXML
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </template>

                <!-- MusicXML-specific Display Settings -->
                <template v-if="melodyDisplayMode === 'xml' && hasMelodyXml && xmlSettings">
                    <p class="label-micro mt-3 border-t border-border px-1 pb-2 pt-3 text-gold">
                        MusicXML Anzeige
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
    Image as ImageIcon,
    Lightbulb,
    List,
    ListMusic,
    Music,
    Settings,
    Type,
} from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { toast } from 'vue-sonner';

import { useServiceStore } from '@/stores/service';

import { isWakeLockSupported } from '@/composables/useWakeLock';

import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import type { MelodyDisplayMode, XmlDisplaySettings } from '@/db';
import type { PanelAnchor } from '@/lib/anchor';

const props = defineProps<{
    songId: string;
    showControls: boolean;
    hasMelodyImage: boolean;
    hasMelodyXml: boolean;
    melodyDisplayMode: MelodyDisplayMode;
    pageScale: number;
    xmlSettings?: XmlDisplaySettings;
    keepScreenAwake: boolean;
}>();

const emit = defineEmits<{
    'update:showControls': [value: boolean];
    'update:keepScreenAwake': [value: boolean];
    'update:melodyDisplayMode': [value: MelodyDisplayMode];
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

const wakeLockSupported = isWakeLockSupported();

const menuOpen = ref(false);
const showPlaylistModal = ref(false);

// Marking from inside the song is the fastest path during a service, so the
// menu gets out of the way again straight after and the toast confirms it.
async function handleToggleService() {
    menuOpen.value = false;
    try {
        const marked = await serviceStore.toggleSong(props.songId);
        toast.success(
            marked ? 'Für den Gottesdienst vorgemerkt' : 'Aus dem Gottesdienst entfernt',
            { duration: 2000 },
        );
    } catch (err) {
        console.error('Failed to update the service selection:', err);
        toast.error('Die Auswahl konnte nicht gespeichert werden.');
    }
}

function onDisplayModeChange(value: AcceptableValue) {
    if (value === 'image' || value === 'xml') {
        emit('update:melodyDisplayMode', value);
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
