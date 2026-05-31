<template>
    <ion-page>
        <SongHeader :song-id="songId" :song-index="song?.index" :song-title="song?.titel" />

        <SongMenuPopover
            v-model:show-controls="showControls"
            :song-id="songId"
            :has-melody-image="hasMelodyImage"
            :has-melody-xml="hasMelodyXml"
            :melody-display-mode="melodyDisplayMode"
            :notation-scale="notationScale"
            :song-font-size="textSize"
            :xml-settings="xmlSettings"
            @update:melody-display-mode="preferencesStore.setMelodyDisplayMode($event)"
            @update:notation-scale="updateNotationScale"
            @update:song-font-size="preferencesStore.setTextSize($event)"
            @update:xml-setting="
                preferencesStore.setXmlSetting($event.key, $event.value as boolean)
            "
        />

        <ion-content :fullscreen="true">
            <!-- Loading State -->
            <SongLoadingState v-if="isLoading" />

            <!-- Error / Not Found State -->
            <SongErrorState v-else-if="!song" />

            <!-- Song Content -->
            <div v-else class="song-content" :class="`text-size-${textSize}`">
                <!-- Melody Display: Image or MusicXML -->
                <SongMelodyImage
                    v-if="melodyDisplayMode === 'image' && hasMelodyImage"
                    :image-url="melodyImageUrl"
                    :is-loading="imageLoading"
                />

                <!-- MusicXML (OSMD) Rendering -->
                <div v-else-if="melodyDisplayMode === 'xml' && hasMelodyXml" class="melody-section">
                    <OsmdRenderer
                        ref="osmdRendererRef"
                        :file-blob="melodyXmlBlob"
                        :scale="notationScale"
                        :settings="xmlSettings"
                        :is-playing="isPlaying"
                        :tempo="tempo"
                        @play-started="isPlaying = true"
                        @play-stopped="isPlaying = false"
                    />
                </div>

                <!-- No Melody Notice -->
                <div v-else-if="!hasMelodyImage && !hasMelodyXml" class="no-melody-notice">
                    <ion-icon :icon="musicalNotesOutline" />
                    <span>Keine Melodie verfügbar</span>
                </div>

                <!-- Song Verses (skip first strophe when XML mode shows lyrics under notes) -->
                <SongVerses
                    :strophes="song.strophen"
                    :skip-first="
                        melodyDisplayMode === 'xml' && hasMelodyXml && xmlSettings.showLyrics
                    "
                />

                <!-- Authors Section -->
                <SongAuthors
                    :text-authors="song.textAutoren"
                    :melody-authors="song.melodieAutoren"
                />
            </div>
        </ion-content>

        <ion-footer
            v-if="song && showControls && melodyDisplayMode === 'xml' && hasMelodyXml"
            class="audio-controls-footer"
        >
            <SongAudioControls
                v-model:loop-enabled="loopEnabled"
                :is-playing="isPlaying"
                :has-paused="hasPaused"
                :tempo="tempo"
                @toggle-play="togglePlay"
                @stop="stopPlayback"
                @increase-tempo="increaseTempo"
                @decrease-tempo="decreaseTempo"
            />
        </ion-footer>
    </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { IonContent, IonFooter, IonIcon, IonPage } from '@ionic/vue';
import { musicalNotesOutline } from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';

import { usePreferencesStore } from '@/stores/preferences';
import { useSongsStore } from '@/stores/songs';

import { useStoredFiles } from '@/composables/useStoredFiles';

import OsmdRenderer from '@/components/songview/OsmdRenderer.vue';
import SongAudioControls from '@/components/songview/SongAudioControls.vue';
import SongAuthors from '@/components/songview/SongAuthors.vue';
import SongErrorState from '@/components/songview/SongErrorState.vue';
import SongHeader from '@/components/songview/SongHeader.vue';
import SongLoadingState from '@/components/songview/SongLoadingState.vue';
import SongMelodyImage from '@/components/songview/SongMelodyImage.vue';
import SongMenuPopover from '@/components/songview/SongMenuPopover.vue';
import SongVerses from '@/components/songview/SongVerses.vue';

import type { Song } from '@/db';

const route = useRoute();
const songsStore = useSongsStore();
const { songs, isLoading } = storeToRefs(songsStore);

const preferencesStore = usePreferencesStore();
const { notationScale, textSize, melodyDisplayMode, xmlSettings } = storeToRefs(preferencesStore);

const { getFileUrl } = useStoredFiles();
const melodyImageUrl = ref<string | null>(null);
const imageLoading = ref(false);
const melodyXmlBlob = ref<Blob | null>(null);

// Refs
const osmdRendererRef = ref<InstanceType<typeof OsmdRenderer> | null>(null);

// Current song
const song = ref<Song | null>(null);

// Song ID from route
const songId = computed(() => route.params.id as string);

// Playback state
const isPlaying = ref(false);
const hasPaused = ref(false);
const loopEnabled = ref(false);
const tempo = ref(120);

// Display options
const showControls = ref(true);

// Check if song has melody image
const hasMelodyImage = computed(() => {
    if (!song.value?.noten || song.value.noten.length === 0) return false;
    // Check if there are any PNG/JPG/SVG files
    return song.value.noten.some((note) => {
        const filename = note.filename_download.toLowerCase();
        return filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg');
    });
});

// Check if song has MusicXML notation (.mxl or .musicxml)
const hasMelodyXml = computed(() => !!song.value?.notentextMxml);

// Load MusicXML blob from stored files (lazily — only when xml mode is active)
async function loadMelodyXml() {
    if (!song.value?.notentextMxml) {
        melodyXmlBlob.value = null;
        return;
    }
    try {
        melodyXmlBlob.value = (await songsStore.getFileBlob(song.value.notentextMxml.id)) || null;
    } catch (err) {
        console.error('Error loading MusicXML blob:', err);
        melodyXmlBlob.value = null;
    }
}

// Load melody image from stored files
async function loadMelodyImage() {
    if (!song.value?.noten || song.value.noten.length === 0) {
        melodyImageUrl.value = null;
        return;
    }

    imageLoading.value = true;
    try {
        // Find the first PNG/JPG/SVG file
        const imageFile = song.value.noten.find((note) => {
            const filename = note.filename_download.toLowerCase();
            return (
                filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.svg')
            );
        });

        if (imageFile) {
            const url = await getFileUrl(imageFile.id);
            melodyImageUrl.value = url;
        } else {
            melodyImageUrl.value = null;
        }
    } catch (err) {
        console.error('Error loading melody image:', err);
        melodyImageUrl.value = null;
    } finally {
        imageLoading.value = false;
    }
}

// Find song by ID
function loadSong() {
    const songId = route.params.id as string;
    if (songId) {
        song.value = songs.value.find((s) => s.id === songId) || null;
        // Load melody assets when song is loaded
        loadMelodyImage();
        loadMelodyXml();
    }
    console.log('Loaded song:', song.value);
}

// Load song on mount and when route changes
onMounted(() => {
    loadSong();
});

watch(
    () => route.params.id,
    () => {
        loadSong();
    },
);

// Also reload when songs are loaded
watch(
    () => songs.value,
    () => {
        if (!song.value) {
            loadSong();
        }
    },
);

// Reload assets when display mode changes
watch(melodyDisplayMode, () => {
    if (melodyDisplayMode.value === 'image') {
        loadMelodyImage();
    } else if (melodyDisplayMode.value === 'xml') {
        loadMelodyXml();
    }
});

// Toggle play/pause
function togglePlay() {
    isPlaying.value = !isPlaying.value;
    if (isPlaying.value) {
        hasPaused.value = true;
    }
}

// Stop playback completely
function stopPlayback() {
    isPlaying.value = false;
    hasPaused.value = false;
    // Call the stop method on the active renderer
    osmdRendererRef.value?.stop();
}

// Tempo controls
function increaseTempo() {
    if (tempo.value < 200) {
        tempo.value += 10;
    }
}

function decreaseTempo() {
    if (tempo.value > 60) {
        tempo.value -= 10;
    }
}

// Notation scale control
function updateNotationScale(value: number | number[] | { lower: number; upper: number }) {
    let scale: number;
    if (typeof value === 'object' && !Array.isArray(value)) {
        scale = value.lower; // For dual knob ranges (we don't use this)
    } else {
        scale = Array.isArray(value) ? value[0] : value;
    }
    preferencesStore.setNotationScale(scale);
}
</script>

<style scoped>
.song-content {
    padding: var(--spacing-md);
    max-width: 800px;
    margin: 0 auto;
}

/* Text size variations */
.song-content.text-size-small {
    --verse-font-size: var(--font-size-sm);
    --verse-line-height: 1.5;
}

.song-content.text-size-medium {
    --verse-font-size: var(--font-size-base);
    --verse-line-height: 1.6;
}

.song-content.text-size-large {
    --verse-font-size: var(--font-size-lg);
    --verse-line-height: 1.7;
}

.song-content.text-size-xlarge {
    --verse-font-size: var(--font-size-xl);
    --verse-line-height: 1.8;
}

/* Melody Section */
.melody-section {
    margin-bottom: var(--spacing-md);
    overflow-x: auto;
}

/* Audio controls footer: opaque background, no iOS translucency */
.audio-controls-footer {
    --background: var(--ion-color-light);
    background: var(--ion-color-light);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
}

.audio-controls-footer::before {
    display: none;
}

.no-melody-notice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    background: var(--ion-color-light);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-lg);
    color: var(--ion-color-medium);
    font-style: italic;
}

.no-melody-notice ion-icon {
    font-size: 20px;
}
</style>
