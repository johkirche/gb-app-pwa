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
                    <div class="flex items-center justify-between gap-3">
                        <Label for="song-font-size" class="flex items-center gap-2.5">
                            <Type
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            Textgröße
                        </Label>
                        <Select :model-value="songFontSize" @update:model-value="onFontSizeChange">
                            <SelectTrigger id="song-font-size" class="h-9 w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="small">Klein</SelectItem>
                                <SelectItem value="medium">Normal</SelectItem>
                                <SelectItem value="large">Groß</SelectItem>
                                <SelectItem value="xlarge">Sehr groß</SelectItem>
                            </SelectContent>
                        </Select>
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
                        <div
                            v-if="melodyDisplayMode === 'xml' && hasMelodyXml"
                            class="space-y-3 pb-1"
                        >
                            <div class="flex items-baseline justify-between gap-3">
                                <span class="flex items-center gap-2.5 text-sm font-medium">
                                    <Music2
                                        class="size-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    Notengröße
                                </span>
                                <span class="number-display text-lg leading-none">
                                    {{ Math.round(notationScale * 100) }}%
                                </span>
                            </div>
                            <!-- Emits continuously while dragging (like ionInput
                                 before) — OSMD re-renders live per change. -->
                            <Slider
                                :model-value="[notationScale]"
                                :min="0.5"
                                :max="2"
                                :step="0.1"
                                aria-label="Notengröße"
                                @update:model-value="onScaleChange"
                            />
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
    Image as ImageIcon,
    List,
    ListMusic,
    Music,
    Music2,
    Settings,
    Type,
} from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';

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

defineProps<{
    songId: string;
    showControls: boolean;
    hasMelodyImage: boolean;
    hasMelodyXml: boolean;
    melodyDisplayMode: MelodyDisplayMode;
    notationScale: number;
    songFontSize: string;
    xmlSettings?: XmlDisplaySettings;
}>();

const emit = defineEmits<{
    'update:showControls': [value: boolean];
    'update:melodyDisplayMode': [value: MelodyDisplayMode];
    'update:notationScale': [value: number];
    'update:songFontSize': [value: 'small' | 'medium' | 'large' | 'xlarge'];
    'update:xmlSetting': [
        payload: {
            key: keyof XmlDisplaySettings;
            value: XmlDisplaySettings[keyof XmlDisplaySettings];
        },
    ];
}>();

const menuOpen = ref(false);
const showPlaylistModal = ref(false);

function onFontSizeChange(value: AcceptableValue) {
    if (value === 'small' || value === 'medium' || value === 'large' || value === 'xlarge') {
        emit('update:songFontSize', value);
    }
}

function onDisplayModeChange(value: AcceptableValue) {
    if (value === 'image' || value === 'xml') {
        emit('update:melodyDisplayMode', value);
    }
}

function onScaleChange(value: number[] | undefined) {
    if (value && typeof value[0] === 'number') {
        emit('update:notationScale', value[0]);
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
