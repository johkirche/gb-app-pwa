<template>
    <ion-popover ref="popoverRef" trigger="song-menu-trigger" :dismiss-on-select="false">
        <ion-content class="menu-content">
            <ion-list lines="none">
                <!-- Actions Group -->
                <ion-list-header>
                    <ion-label>Aktionen</ion-label>
                </ion-list-header>
                <ion-item button @click="handleAddToPlaylist">
                    <ion-icon slot="start" :icon="listOutline" />
                    <ion-label>Zu Playlist hinzufügen</ion-label>
                </ion-item>

                <!-- Display Settings Group -->
                <ion-list-header>
                    <ion-label>Anzeige</ion-label>
                </ion-list-header>
                <ion-item>
                    <ion-icon slot="start" :icon="textOutline" />
                    <ion-label>Textgröße</ion-label>
                    <ion-select
                        slot="end"
                        :value="songFontSize"
                        @ionChange="$emit('update:songFontSize', $event.detail.value)"
                    >
                        <ion-select-option value="small">Klein</ion-select-option>
                        <ion-select-option value="medium">Normal</ion-select-option>
                        <ion-select-option value="large">Groß</ion-select-option>
                        <ion-select-option value="xlarge">Sehr groß</ion-select-option>
                    </ion-select>
                </ion-item>
                <ion-item>
                    <ion-icon slot="start" :icon="musicalNotesOutline" />
                    <ion-label>Steuerung anzeigen</ion-label>
                    <ion-toggle
                        slot="end"
                        :checked="showControls"
                        @ionChange="$emit('update:showControls', $event.detail.checked)"
                    />
                </ion-item>

                <!-- Melody Settings Group (only shown when relevant) -->
                <template v-if="hasMelodyImage || hasMelodyXml">
                    <ion-list-header>
                        <ion-label>Noten</ion-label>
                    </ion-list-header>
                    <ion-item>
                        <ion-icon slot="start" :icon="imageOutline" />
                        <ion-label>Notenansicht</ion-label>
                        <ion-select
                            slot="end"
                            :value="melodyDisplayMode"
                            interface="popover"
                            @ionChange="$emit('update:melodyDisplayMode', $event.detail.value)"
                        >
                            <ion-select-option value="image" :disabled="!hasMelodyImage">
                                Notenbild
                            </ion-select-option>
                            <ion-select-option value="xml" :disabled="!hasMelodyXml">
                                MusicXML
                            </ion-select-option>
                        </ion-select>
                    </ion-item>
                    <ion-item v-if="melodyDisplayMode === 'xml' && hasMelodyXml">
                        <ion-icon slot="start" :icon="musicalNoteOutline" />
                        <ion-label>
                            <p>Notengröße</p>
                            <p class="scale-value">{{ Math.round(notationScale * 100) }}%</p>
                        </ion-label>
                        <ion-range
                            slot="end"
                            :min="0.5"
                            :max="2.0"
                            :step="0.1"
                            :value="notationScale"
                            :pin="true"
                            :pin-formatter="(value: number) => `${Math.round(value * 100)}%`"
                            @ionInput="handleNotationScaleChange($event.detail.value)"
                        />
                    </ion-item>
                </template>

                <!-- MusicXML-specific Display Settings -->
                <template v-if="melodyDisplayMode === 'xml' && hasMelodyXml && xmlSettings">
                    <ion-list-header>
                        <ion-label>MusicXML Anzeige</ion-label>
                    </ion-list-header>
                    <ion-item>
                        <ion-icon slot="start" :icon="listOutline" />
                        <ion-label>Taktnummern</ion-label>
                        <ion-toggle
                            slot="end"
                            :checked="xmlSettings.showMeasureNumbers"
                            @ionChange="
                                $emit('update:xmlSetting', {
                                    key: 'showMeasureNumbers',
                                    value: $event.detail.checked,
                                })
                            "
                        />
                    </ion-item>
                    <ion-item>
                        <ion-icon slot="start" :icon="textOutline" />
                        <ion-label>Liedtext unter Noten</ion-label>
                        <ion-toggle
                            slot="end"
                            :checked="xmlSettings.showLyrics"
                            @ionChange="
                                $emit('update:xmlSetting', {
                                    key: 'showLyrics',
                                    value: $event.detail.checked,
                                })
                            "
                        />
                    </ion-item>
                </template>
            </ion-list>
        </ion-content>
    </ion-popover>

    <!-- Playlist Select Modal -->
    <PlaylistSelectModal
        :is-open="showPlaylistModal"
        :song-id="songId"
        @close="showPlaylistModal = false"
        @added="onSongAddedToPlaylist"
    />
</template>

<script setup lang="ts">
import { ref } from 'vue';

import {
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonPopover,
    IonRange,
    IonSelect,
    IonSelectOption,
    IonToggle,
} from '@ionic/vue';
import {
    imageOutline,
    listOutline,
    musicalNoteOutline,
    musicalNotesOutline,
    textOutline,
} from 'ionicons/icons';

import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue';

import type { MelodyDisplayMode, XmlDisplaySettings } from '@/db';

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

type RangeValue = number | { lower: number; upper: number };

const showPlaylistModal = ref(false);
const popoverRef = ref<InstanceType<typeof IonPopover> | null>(null);

function handleNotationScaleChange(value: RangeValue) {
    if (typeof value === 'number') {
        emit('update:notationScale', value);
    } else {
        emit('update:notationScale', value.lower);
    }
}

async function handleAddToPlaylist() {
    // Close the popover first
    await popoverRef.value?.$el.dismiss();
    // Then open the playlist modal
    showPlaylistModal.value = true;
}

function onSongAddedToPlaylist(_playlistId: string) {
    // Could show a toast notification here
    showPlaylistModal.value = false;
}
</script>

<style scoped>
ion-popover {
    --width: 280px;
}

ion-popover ion-list-header {
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-top: var(--spacing-sm);
    padding-bottom: var(--spacing-sm);
}

ion-popover ion-list-header:not(:first-child) {
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--ion-color-light);
}

ion-popover ion-item {
    --padding-start: var(--spacing-md);
    --padding-end: var(--spacing-md);
    --inner-padding-end: 0;
}

.scale-value {
    font-size: 0.85rem;
    color: var(--ion-color-primary);
    font-weight: 500;
}

ion-popover ion-range {
    --bar-background: var(--ion-color-light);
    --bar-background-active: var(--ion-color-primary);
    --knob-background: var(--ion-color-primary);
    --knob-size: 20px;
    --pin-background: var(--ion-color-primary);
    padding: 0 8px;
    width: 120px;
}
</style>
