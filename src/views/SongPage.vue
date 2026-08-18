<template>
    <div class="flex h-full flex-col bg-background">
        <SongHeader :song-id="songId" :song-index="song?.index" :song-title="song?.titel">
            <template #menu>
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
            </template>
        </SongHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <!-- Loading State -->
            <SongLoadingState v-if="isLoading" />

            <!-- Error / Not Found State -->
            <SongErrorState v-else-if="!song" />

            <!-- Song Content -->
            <div v-else class="song-content page-col pb-8 pt-4" :class="`text-size-${textSize}`">
                <!-- Melody Display: Image or MusicXML -->
                <SongMelodyImage
                    v-if="melodyDisplayMode === 'image' && hasMelodyImage"
                    :svg-markup="melodySvgMarkup"
                    :image-url="melodyImageUrl"
                    :is-loading="imageLoading"
                />

                <!-- MusicXML (OSMD) Rendering -->
                <div
                    v-else-if="melodyDisplayMode === 'xml' && hasMelodyXml"
                    class="notation-col mb-4"
                >
                    <OsmdRenderer
                        ref="osmdRendererRef"
                        :file-blob="melodyXmlBlob"
                        :scale="notationScale"
                        :settings="xmlSettings"
                        :is-playing="isPlaying"
                        :tempo="tempo"
                        @play-started="isPlaying = true"
                        @play-stopped="isPlaying = false"
                        @rendered="onNotationRendered"
                        @render-failed="onNotationRenderFailed"
                    />
                    <div
                        v-if="notationState === 'blob-missing-offline'"
                        class="flex items-center justify-center gap-2 rounded-lg bg-muted p-6 italic text-muted-foreground"
                    >
                        <Music class="size-5 shrink-0" aria-hidden="true" />
                        <span>
                            Noten sind offline nicht verfügbar. Stellen Sie eine Internetverbindung
                            her und laden Sie das Lied erneut.
                        </span>
                    </div>
                    <div
                        v-else-if="notationState === 'blob-fetch-failed'"
                        class="flex items-center justify-center gap-2 rounded-lg bg-muted p-6 italic text-muted-foreground"
                    >
                        <Music class="size-5 shrink-0" aria-hidden="true" />
                        <span>Noten konnten nicht geladen werden.</span>
                    </div>
                </div>

                <!-- No Melody Notice -->
                <div
                    v-else-if="!hasMelodyImage && !hasMelodyXml"
                    class="mb-6 flex items-center justify-center gap-2 rounded-lg bg-muted p-6 italic text-muted-foreground"
                >
                    <Music class="size-5 shrink-0" aria-hidden="true" />
                    <span>Keine Melodie verfügbar</span>
                </div>

                <!-- Song Verses: every verse is listed, including the one the
                     notation already carries under its notes -->
                <SongVerses :strophes="song.strophen" />

                <!-- Authors Section -->
                <SongAuthors :song="song" />
            </div>
        </main>

        <!-- Docked audio transport: opaque, above the safe area -->
        <footer
            v-if="
                song &&
                showControls &&
                melodyDisplayMode === 'xml' &&
                hasMelodyXml &&
                notationState === 'ready'
            "
            class="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
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
        </footer>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Music } from 'lucide-vue-next';
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
import { sanitizeNotationSvg } from '@/utils/notationSvg';

const route = useRoute();
const songsStore = useSongsStore();
const { songs, isLoading } = storeToRefs(songsStore);

const preferencesStore = usePreferencesStore();
const { notationScale, textSize, melodyDisplayMode, xmlSettings } = storeToRefs(preferencesStore);

const { getFileUrl } = useStoredFiles();
const melodySvgMarkup = ref<string | null>(null);
const melodyImageUrl = ref<string | null>(null);
const imageLoading = ref(false);
const melodyXmlBlob = ref<Blob | null>(null);

// Notation lifecycle: distinguishes a missing blob (offline vs. fetch error)
// from a failed render — each shows its own notice.
const notationState = ref<
    'loading' | 'ready' | 'blob-missing-offline' | 'blob-fetch-failed' | 'render-failed'
>('loading');

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

// Check if song has a Notenbild: the vector engraving, or — for songs cached
// before notentext_svg was synced — one of the legacy raster files.
const hasMelodyImage = computed(() => {
    if (song.value?.notentextSvg) return true;
    return !!song.value?.noten?.some((note) => hasRasterExtension(note.filename_download));
});

// Check if song has MusicXML notation (.mxl or .musicxml)
const hasMelodyXml = computed(() => !!song.value?.notentextMxml);

// Load MusicXML blob from stored files (lazily — only when xml mode is active).
// Falls back to an on-demand network fetch (stored back into Dexie) when the
// blob is missing locally.
async function loadMelodyXml() {
    if (!song.value?.notentextMxml) {
        melodyXmlBlob.value = null;
        return;
    }
    notationState.value = 'loading';
    try {
        const blob = await songsStore.getOrFetchFileBlob(
            song.value.notentextMxml.id,
            song.value.notentextMxml.filename_download,
        );
        melodyXmlBlob.value = blob;
        if (!blob) {
            notationState.value = navigator.onLine ? 'blob-fetch-failed' : 'blob-missing-offline';
        }
    } catch (err) {
        console.error('Error loading MusicXML blob:', err);
        melodyXmlBlob.value = null;
        notationState.value = navigator.onLine ? 'blob-fetch-failed' : 'blob-missing-offline';
    }
}

// Outcome of the actual OSMD render — only a real render may flip this.
function onNotationRendered() {
    notationState.value = 'ready';
}

function onNotationRenderFailed() {
    notationState.value = 'render-failed';
}

function hasRasterExtension(filename: string): boolean {
    const name = filename.toLowerCase();
    return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
}

// Load the Notenbild: the vector engraving (notentext_svg) is the source, and
// its markup is inlined so it can follow the theme. A song stored before that
// field was synced — or an SVG that will not parse — falls back to the legacy
// raster file, which can only be shown through <img>.
async function loadMelodyImage() {
    const current = song.value;
    melodySvgMarkup.value = null;
    melodyImageUrl.value = null;
    if (!current) return;

    imageLoading.value = true;
    try {
        if (current.notentextSvg) {
            const blob = await songsStore.getOrFetchFileBlob(
                current.notentextSvg.id,
                current.notentextSvg.filename_download,
            );
            if (blob) {
                melodySvgMarkup.value = sanitizeNotationSvg(await blob.text());
            }
        }

        if (!melodySvgMarkup.value) {
            const imageFile = current.noten.find((note) =>
                hasRasterExtension(note.filename_download),
            );
            if (imageFile) {
                melodyImageUrl.value = await getFileUrl(imageFile.id, imageFile.filename_download);
            }
        }
    } catch (err) {
        console.error('Error loading Notenbild:', err);
    } finally {
        imageLoading.value = false;
    }
}

// Find song by ID
function loadSong() {
    const songId = route.params.id as string;
    if (songId) {
        song.value = songs.value.find((s) => s.id === songId) || null;
        // Reset notation outcome before loading the next song's assets
        notationState.value = 'loading';
        // Load only the active display mode's asset — getOrFetchFileBlob has a
        // network fallback, so eagerly loading both would spend bandwidth and
        // quota on the asset the current mode never shows. The
        // melodyDisplayMode watcher loads the other asset on switch.
        // Drop the inactive mode's stale asset so a later switch cannot
        // briefly show the previous song's melody.
        if (melodyDisplayMode.value === 'xml') {
            melodySvgMarkup.value = null;
            melodyImageUrl.value = null;
            loadMelodyXml();
        } else {
            melodyXmlBlob.value = null;
            loadMelodyImage();
        }
    }
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
    notationState.value = 'loading';
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

// Notation scale control (the popover already unwraps the slider's number[])
function updateNotationScale(value: number) {
    preferencesStore.setNotationScale(value);
}
</script>

<style scoped>
/* Live text-size contract consumed by SongVerses (via --verse-font-size /
   --verse-line-height): the popover's Textgröße select toggles these classes. */
.song-content.text-size-small {
    --verse-font-size: 1rem;
    --verse-line-height: 1.5;
}

.song-content.text-size-medium {
    --verse-font-size: 1.125rem;
    --verse-line-height: 1.6;
}

.song-content.text-size-large {
    --verse-font-size: 1.3125rem;
    --verse-line-height: 1.7;
}

.song-content.text-size-xlarge {
    --verse-font-size: 1.5rem;
    --verse-line-height: 1.8;
}
</style>
