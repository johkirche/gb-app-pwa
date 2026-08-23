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
                    :page-scale="pageScale"
                    :xml-settings="xmlSettings"
                    :keep-screen-awake="keepScreenAwake"
                    @update:melody-display-mode="preferencesStore.setMelodyDisplayMode($event)"
                    @update:page-scale="preferencesStore.setPageScale($event)"
                    @update:keep-screen-awake="preferencesStore.setKeepScreenAwake($event)"
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
            <!-- One scale for the page: the notation is drawn at it, and the
                 verses — which are set at the notation's own size — follow
                 through --text-scale. min-h-full and the flex column let the
                 credits be pushed to the foot of the page: with the transport
                 hidden a short song would otherwise leave them stranded
                 mid-screen above a large void. -->
            <div
                v-else
                class="song-content page-col flex min-h-full flex-col pb-8 pt-4"
                :style="{ '--text-scale': pageScale }"
            >
                <!-- Melody Display: Image or MusicXML -->
                <SongMelodyImage
                    v-if="melodyDisplayMode === 'image' && hasMelodyImage"
                    :svg-markup="melodySvgMarkup"
                    :image-url="melodyImageUrl"
                    :is-loading="imageLoading"
                    :scale="pageScale"
                />

                <!-- MusicXML (OSMD) Rendering -->
                <div
                    v-else-if="melodyDisplayMode === 'xml' && hasMelodyXml"
                    class="notation-col mb-4"
                >
                    <OsmdRenderer
                        ref="osmdRendererRef"
                        :file-blob="melodyXmlBlob"
                        :scale="pageScale"
                        :settings="xmlSettings"
                        :is-playing="isPlaying"
                        :tempo="tempo"
                        :loop="loopEnabled"
                        :muted="isMuted"
                        @play-started="isPlaying = true"
                        @play-stopped="isPlaying = false"
                        @ended="onPlaybackEnded"
                        @engine-loading="engineLoading = $event"
                        @progress="onPlaybackProgress"
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

                <!-- Song Verses: verse 1 is left out while the notation on
                     screen already carries it under its notes — the vector
                     Notenbild always, the MusicXML view whenever "Liedtext
                     unter Noten" is on -->
                <SongVerses
                    :strophes="song.strophen"
                    :skip-first="lyricsInNotation"
                    :scale="pageScale"
                />

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
                v-model:muted="isMuted"
                :is-playing="isPlaying"
                :is-loading="engineLoading"
                :has-paused="hasPaused"
                :tempo="tempo"
                :position="playbackPosition"
                :duration="playbackDuration"
                @toggle-play="togglePlay"
                @stop="stopPlayback"
                @seek="seekPlayback"
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

import {
    type NowPlaying,
    type NowPlayingState,
    useMediaSession,
} from '@/composables/useMediaSession';
import { useStoredFiles } from '@/composables/useStoredFiles';
import { useWakeLock } from '@/composables/useWakeLock';

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
import { authorFilterName } from '@/utils/authorFormat';
import { sanitizeNotationSvg } from '@/utils/notationSvg';

const route = useRoute();
const songsStore = useSongsStore();
const { songs, isLoading } = storeToRefs(songsStore);

const preferencesStore = usePreferencesStore();
const { pageScale, melodyDisplayMode, xmlSettings, keepScreenAwake } =
    storeToRefs(preferencesStore);

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
// Silent playback: the notation still follows the song note by note, which is
// what a reader wants when they only need to find their place on the page.
const isMuted = ref(false);
const tempo = ref(120);
// The first play tap fetches the soundfont, which takes seconds — the
// transport says so rather than looking unresponsive.
const engineLoading = ref(false);
// Seconds played and the song's length at the current tempo, both reported by
// the renderer: only it knows where in the sheet the music stands.
const playbackPosition = ref(0);
const playbackDuration = ref(0);
// Whether this hymn is the one the platform is showing. Set by the first play
// tap and kept past the final note, so the lock screen still offers a play
// button for the next verse; cleared by Stop and by moving to another song.
const playbackEngaged = ref(false);

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

// Whether the OSMD view is currently singing the words under its notes — both
// halves of that answer (does the sheet carry lyrics, is "Liedtext unter
// Noten" on) are the renderer's to give, so it reports it with every render.
const notationLyricsDrawn = ref(false);

// Whether the notation currently on screen already sings verse 1 under its
// notes. True for the vector Notenbild, whose Finale export bakes the first
// verse into the engraving, and for the MusicXML view whenever it draws
// lyrics. The raster fallback is left out: those scans are only reached for
// songs cached before notentext_svg was synced, and what they contain is not
// known per file.
const lyricsInNotation = computed(() => {
    if (melodyDisplayMode.value === 'image') return !!melodySvgMarkup.value;
    return notationState.value === 'ready' && notationLyricsDrawn.value;
});

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
function onNotationRendered(info: { lyricsDrawn: boolean }) {
    notationState.value = 'ready';
    notationLyricsDrawn.value = info.lyricsDrawn;
}

function onNotationRenderFailed() {
    notationState.value = 'render-failed';
    notationLyricsDrawn.value = false;
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
        notationLyricsDrawn.value = false;
        // The renderer drops the engine built for the previous sheet, so the
        // transport has to come back to rest with it — otherwise it would go on
        // showing "Pause" over a song that is not playing.
        resetPlayback();
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
    notationLyricsDrawn.value = false;
    // Switching to the Notenbild unmounts the renderer that owns the audio, so
    // the transport — and with it the platform's controls — has to come to rest
    // too. Left alone, the lock screen would go on offering "Pause" for a
    // player that no longer exists.
    resetPlayback();
    if (melodyDisplayMode.value === 'image') {
        loadMelodyImage();
    } else if (melodyDisplayMode.value === 'xml') {
        loadMelodyXml();
    }
});

// Everything the transport shows, back at rest. Called wherever the renderer
// that owns the audio is dropped: another hymn, another notation view.
function resetPlayback() {
    isPlaying.value = false;
    hasPaused.value = false;
    playbackEngaged.value = false;
    playbackPosition.value = 0;
    playbackDuration.value = 0;
}

// Start / pause / toggle. Split apart because the platform's own controls
// address them separately: a lock-screen "play" must never come out as a
// pause because the two got out of step.
function startPlayback() {
    if (isPlaying.value) return;
    isPlaying.value = true;
    hasPaused.value = true;
    playbackEngaged.value = true;
}

function pausePlayback() {
    isPlaying.value = false;
}

function togglePlay() {
    if (isPlaying.value) pausePlayback();
    else startPlayback();
}

// Stop playback completely
function stopPlayback() {
    isPlaying.value = false;
    hasPaused.value = false;
    playbackEngaged.value = false;
    // Call the stop method on the active renderer
    osmdRendererRef.value?.stop();
}

function seekPlayback(fraction: number) {
    osmdRendererRef.value?.seek(fraction);
}

function seekToSeconds(seconds: number) {
    if (playbackDuration.value <= 0) return;
    const clamped = Math.max(0, Math.min(playbackDuration.value, seconds));
    seekPlayback(clamped / playbackDuration.value);
}

function onPlaybackProgress(value: { position: number; duration: number }) {
    playbackPosition.value = value.position;
    playbackDuration.value = value.duration;
}

// The song ran out. With Wiederholung on the renderer starts it over itself,
// so only the one-off case has anything to reset here.
function onPlaybackEnded() {
    if (!loopEnabled.value) {
        hasPaused.value = false;
    }
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

// --- The song page and the device it is held in ---------------------------

// Verse three is exactly when the screen dims and the reader loses their place
// fumbling to unlock. The hold stands while this page is open and on screen;
// leaving it — or turning the setting off — drops it, and everything no-ops
// where the platform has no wake lock at all.
useWakeLock(() => keepScreenAwake.value);

// Playback is a Web Audio scheduler, so nothing about it reaches the OS by
// itself: no hymn on the lock screen, no headset play/pause. This is what
// tells the platform what is playing. A source is only claimed once the reader
// has actually started a hymn — merely opening a song page must not take the
// lock screen away from whatever else is playing.
const nowPlayingArtist = computed(() => {
    const current = song.value;
    if (!current) return '';
    // The melody is what is sounding; its author is the one to name. Songs
    // that carry no melody author fall back to the text's.
    const authors = current.melodieAutoren?.length ? current.melodieAutoren : current.textAutoren;
    return (authors ?? [])
        .map((author) => authorFilterName(author))
        .filter(Boolean)
        .join(', ');
});

const nowPlaying = computed<NowPlaying | null>(() => {
    const current = song.value;
    if (!current) return null;
    return {
        // The number reads first, as it does in the book and in the header.
        title: current.index ? `${current.index}. ${current.titel}` : current.titel,
        artist: nowPlayingArtist.value,
        album: 'Gesangbuch der Johannischen Kirche',
    };
});

const nowPlayingState = computed<NowPlayingState>(() => {
    if (!playbackEngaged.value) return 'none';
    return isPlaying.value ? 'playing' : 'paused';
});

useMediaSession({
    metadata: nowPlaying,
    state: nowPlayingState,
    position: () =>
        playbackDuration.value > 0
            ? { position: playbackPosition.value, duration: playbackDuration.value }
            : null,
    handlers: {
        play: startPlayback,
        pause: pausePlayback,
        stop: stopPlayback,
        seekto: (details) => {
            if (typeof details.seekTime === 'number') seekToSeconds(details.seekTime);
        },
        seekbackward: (details) =>
            seekToSeconds(playbackPosition.value - (details.seekOffset ?? 10)),
        seekforward: (details) =>
            seekToSeconds(playbackPosition.value + (details.seekOffset ?? 10)),
    },
});
</script>

<style scoped>
/* Live size contract consumed by SongVerses (via --verse-font-size /
   --verse-line-height): one factor, set inline from the page's scale.

   The size is not a length but the notation's own: the book sets its verses in
   the same face and the same size as the lyrics under the notes, and that size
   follows the engraving as it scales into the column. cqw is what makes it
   expressible — the notation's width is this container's width capped at
   --notation-max, and --verse-measure carries the rest of the book's
   arithmetic. The scale multiplies it, exactly as it multiplies the drawn
   notation, so the printed proportion holds at every setting. */
.song-content {
    container-type: inline-size;
    --notation-width: min(100cqw, var(--notation-max));
    --verse-font-size: calc(var(--notation-width) / var(--verse-measure) * var(--text-scale, 1));
    /* The book leads its verses at 1.20. On a screen that is airless, but the
       type is now printed size, so it stays far tighter than screen defaults. */
    --verse-line-height: 1.35;
}
</style>
