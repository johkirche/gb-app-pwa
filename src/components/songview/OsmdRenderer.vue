<template>
    <div ref="containerRef" class="relative w-full">
        <!-- Wide scores scroll horizontally inside this container, never the page -->
        <div
            ref="notationRef"
            class="w-full overflow-x-auto overflow-y-hidden [&_svg]:h-auto [&_svg]:max-w-full"
        ></div>

        <div
            v-if="renderError"
            class="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive"
        >
            <AlertCircle class="size-5 shrink-0" aria-hidden="true" />
            <span>{{ renderError }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { AlertCircle } from 'lucide-vue-next';
import type { OpenSheetMusicDisplay as OSMDType } from 'opensheetmusicdisplay';
import type PlaybackEngineType from 'osmd-audio-player';

import type { XmlDisplaySettings } from '@/db';

const props = defineProps<{
    fileBlob: Blob | null;
    scale?: number;
    settings?: XmlDisplaySettings;
    isPlaying?: boolean;
    tempo?: number;
}>();

const emit = defineEmits<{
    (e: 'playStarted'): void;
    (e: 'playStopped'): void;
    (e: 'rendered'): void;
    (e: 'renderFailed', reason: 'corrupt' | 'engine'): void;
}>();

defineExpose({ stop: stopPlayback });

const containerRef = ref<HTMLElement | null>(null);
const notationRef = ref<HTMLElement | null>(null);
const renderError = ref<string | null>(null);

let osmd: OSMDType | null = null;
let playbackEngine: PlaybackEngineType | null = null;
let isInitialized = false;
let themeObserver: MutationObserver | null = null;
// In-flight guard for the lazy (multi-second) engine construction: without
// it, play→pause→play during init would build two engines that both play,
// with the first one unstoppable.
let initPromise: Promise<void> | null = null;
// Monotonic token so only the latest play request actually starts playback
// after the shared init finishes — earlier awaiters must not call play() too.
let playRequestToken = 0;

const isDarkMode = ref(false);

function detectDarkMode() {
    isDarkMode.value = document.documentElement.classList.contains('dark');
}

function getOsmdOptions() {
    const s = props.settings;
    const fg = isDarkMode.value ? '#e5e5e5' : undefined; // undefined keeps OSMD's default (black)
    return {
        autoResize: true,
        backend: 'svg' as const,
        // Song title/composer live in the page header — never render them inside the score.
        drawTitle: false,
        drawSubtitle: false,
        drawComposer: false,
        drawLyricist: false,
        drawPartNames: false,
        drawMeasureNumbers: s?.showMeasureNumbers ?? false,
        drawLyrics: s?.showLyrics ?? true,
        renderSingleHorizontalStaffline: false,
        compactMode: true,
        defaultColorMusic: fg,
        defaultColorLabel: fg,
        defaultColorTitle: fg,
        defaultFontFamily: 'Helvetica, Arial, sans-serif',
    };
}

async function initOsmd() {
    if (!notationRef.value) return;

    try {
        detectDarkMode();
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        osmd = new OpenSheetMusicDisplay(notationRef.value, getOsmdOptions());
        applyEngravingTweaks();
        isInitialized = true;
        await loadAndRender();

        // Watch for theme toggle on documentElement (.dark class, set by useTheme)
        themeObserver = new MutationObserver(() => {
            const wasDark = isDarkMode.value;
            detectDarkMode();
            if (wasDark !== isDarkMode.value && osmd) {
                (osmd as any).setOptions(getOsmdOptions());
                try {
                    osmd.render();
                } catch {
                    // No sheet loaded (blob missing/failed) — OSMD 1.9.9
                    // render() throws without a sheet; nothing to re-render.
                }
            }
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
    } catch (error) {
        console.error('Failed to load OSMD:', error);
        renderError.value = 'Notation konnte nicht geladen werden';
        emit('renderFailed', 'engine');
    }
}

// Tighten OSMD's default page/system margins for a denser hymnal layout.
// Also collapse the inter-system gap when lyrics are hidden — otherwise
// OSMD leaves the space it would have used for lyrics empty.
function applyEngravingTweaks() {
    if (!osmd) return;
    const rules = (osmd as any).EngravingRules;
    if (!rules) return;
    rules.PageLeftMargin = 1;
    rules.PageRightMargin = 1;
    rules.PageTopMargin = 1;
    rules.PageBottomMargin = 1;
    rules.SystemLeftMargin = 0;
    rules.SystemRightMargin = 0;

    const lyricsOn = props.settings?.showLyrics ?? true;
    if (lyricsOn) {
        // Restore OSMD defaults (values taken from EngravingRules ctor).
        rules.MinimumDistanceBetweenSystems = 7;
        rules.MinSkyBottomDistBetweenSystems = 5;
    } else {
        // Without lyrics, slam the systems closer together.
        rules.MinimumDistanceBetweenSystems = 2;
        rules.MinSkyBottomDistBetweenSystems = 1;
    }
}

async function loadAndRender() {
    if (!osmd || !props.fileBlob) return;

    try {
        renderError.value = null;

        const arrayBuffer = await props.fileBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const isMxl = bytes[0] === 0x50 && bytes[1] === 0x4b;

        if (isMxl) {
            let binaryStr = '';
            for (let i = 0; i < bytes.length; i++) {
                binaryStr += String.fromCharCode(bytes[i]);
            }
            await osmd.load(binaryStr);
        } else {
            const text = new TextDecoder('utf-8').decode(bytes);
            await osmd.load(text);
        }

        applyScale();
        osmd.render();

        emit('rendered');

        // Invalidate any engine built for a previous sheet — playback is
        // constructed lazily on the first play tap (see startPlayback), so the
        // soundfont is never fetched just because a song was opened.
        if (playbackEngine) {
            try {
                await playbackEngine.stop();
            } catch {
                // ignore
            }
            playbackEngine = null;
        }
    } catch (error) {
        console.error('Failed to render MusicXML:', error);
        renderError.value = 'Fehler beim Rendern der Noten';
        emit('renderFailed', 'corrupt');
    }
}

async function initPlayback() {
    if (!osmd) return;

    // Tear down any previous engine
    if (playbackEngine) {
        try {
            await playbackEngine.stop();
        } catch {
            // ignore
        }
        playbackEngine = null;
    }

    try {
        const { default: PlaybackEngine } = await import('osmd-audio-player');
        const { AudioContext } = await import('standardized-audio-context');
        const { LocalSoundfontPlayer } = await import('@/services/localSoundfontPlayer');
        // Local instrument player: soundfonts come precached from the app's
        // own origin (public/soundfonts/) — no gleitz.github.io request.
        playbackEngine = new PlaybackEngine(new AudioContext(), new LocalSoundfontPlayer());
        await playbackEngine.loadScore(osmd as any);
        if (props.tempo) {
            playbackEngine.setBpm(props.tempo);
        }
    } catch (error) {
        console.error('Failed to init OSMD audio player:', error);
        // Audio failure should not block visual rendering
        playbackEngine = null;
    }
}

function applyScale() {
    if (!osmd) return;
    osmd.Zoom = props.scale ?? 1.0;
}

async function startPlayback() {
    const token = ++playRequestToken;
    if (!playbackEngine) {
        // Lazy engine construction on the first play tap — inside the user
        // gesture, which also satisfies the browser autoplay policy.
        // Concurrent callers share one in-flight init instead of each
        // building their own engine.
        initPromise ??= initPlayback().finally(() => {
            initPromise = null;
        });
        await initPromise;
    }
    if (!playbackEngine) {
        // Engine could not be built — tell the parent so the play button
        // does not stay stuck in the "pause" state.
        emit('playStopped');
        return;
    }
    // The user may have tapped pause (or play again) while the engine was
    // still initializing — only the latest request with play still active
    // may start playback.
    if (token !== playRequestToken || !props.isPlaying) {
        return;
    }
    try {
        await playbackEngine.play();
        emit('playStarted');
    } catch (error) {
        console.error('OSMD playback error:', error);
        emit('playStopped');
    }
}

function pausePlayback() {
    if (!playbackEngine) return;
    try {
        playbackEngine.pause();
    } catch (error) {
        console.error('OSMD pause error:', error);
    }
}

async function stopPlayback() {
    if (!playbackEngine) return;
    try {
        await playbackEngine.stop();
    } catch (error) {
        console.error('OSMD stop error:', error);
    }
    emit('playStopped');
}

watch(
    () => props.fileBlob,
    () => {
        if (isInitialized) {
            loadAndRender();
        }
    },
);

watch(
    () => props.scale,
    () => {
        if (osmd && isInitialized) {
            applyScale();
            try {
                osmd.render();
            } catch {
                // No sheet loaded (blob missing/failed) — OSMD 1.9.9
                // render() throws without a sheet; nothing to re-render.
            }
        }
    },
);

watch(
    () => props.settings,
    () => {
        if (osmd && isInitialized) {
            // setOptions accepts a partial options object
            (osmd as any).setOptions(getOsmdOptions());
            applyEngravingTweaks();
            try {
                osmd.render();
            } catch {
                // No sheet loaded (blob missing/failed) — nothing re-rendered,
                // so there is no state change to announce.
                return;
            }
            // Re-emit after every settings re-render so a successful
            // re-render is reported as such.
            if (osmd.Sheet) {
                emit('rendered');
            }
        }
    },
    { deep: true },
);

watch(
    () => props.tempo,
    (newTempo) => {
        if (playbackEngine && newTempo) {
            playbackEngine.setBpm(newTempo);
        }
    },
);

watch(
    () => props.isPlaying,
    (newValue) => {
        if (newValue) {
            startPlayback();
        } else {
            pausePlayback();
        }
    },
);

onMounted(() => {
    initOsmd();
});

onBeforeUnmount(async () => {
    if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
    }
    if (playbackEngine) {
        try {
            await playbackEngine.stop();
        } catch {
            // ignore
        }
        playbackEngine = null;
    }
    if (osmd) {
        try {
            osmd.clear();
        } catch {
            // ignore
        }
        osmd = null;
    }
});
</script>
