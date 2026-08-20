<template>
    <div ref="containerRef" class="relative w-full">
        <!-- The engraving stays centred, and Notengröße grows it to both
             sides — out of the notation column and into the page's free width.
             Only once even that is used up (phone widths, where there is none
             to grow into) does this scroll, and then from its left edge. -->
        <div class="notation-scroll flex overflow-x-auto overflow-y-hidden" :style="scrollBoxStyle">
            <!-- The engraving is laid out at the printed page's geometry and
                 only then scaled into the column, so the systems break where
                 the book breaks them at every width. Notengröße scales the
                 picture; it must not reach the layout, or the breaks move. -->
            <div
                ref="notationRef"
                class="notation-canvas shrink-0 [&_svg]:h-auto [&_svg]:w-full"
                :style="canvasStyle"
            ></div>
        </div>

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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { AlertCircle } from 'lucide-vue-next';
import type { OpenSheetMusicDisplay as OSMDType } from 'opensheetmusicdisplay';
import type PlaybackEngineType from 'osmd-audio-player';

import { useNotationScale } from '@/composables/useNotationScale';

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
    (e: 'rendered', info: { lyricsDrawn: boolean }): void;
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

// How wide the drawn engraving gets. Shared with the Notenbild so one scale
// means the same thing in either view — see useNotationScale.
const { scrollBoxStyle, canvasStyle } = useNotationScale(
    containerRef,
    computed(() => props.scale ?? 1),
);

function getOsmdOptions() {
    const s = props.settings;
    const fg = isDarkMode.value ? '#e5e5e5' : undefined; // undefined keeps OSMD's default (black)
    return {
        // The host is sized to the print block for every render (see
        // renderAtPrintGeometry); letting OSMD re-lay-out on resize would
        // measure the column instead and move the system breaks.
        autoResize: false,
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
        // The lyrics belong to the engraving, so they are set in the
        // engraving's own face — the same Optima the Notenbild carries baked
        // into outlines, so switching between the two views does not switch
        // typeface.
        defaultFontFamily: 'GbOptima, Optima, Candara, Gill Sans, sans-serif',
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
                    renderAtPrintGeometry();
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

// Lay the sheet out on the printed hymnal's page rather than on OSMD's own.
//
// The Notenbild is the book's engraving verbatim, and its geometry is the same
// for all 564 songs: a 249.44pt block holding a 240.96pt system, drawn with a
// 3.81pt staff space, 8.36pt above the first staff line and ~20.5pt below the
// last. OSMD measures in units of one staff space and draws it as 10px at
// zoom 1, which gives the conversion below and lets every print measurement be
// stated as itself.
const PRINT_BLOCK_WIDTH_PT = 249.44;
const PRINT_SYSTEM_WIDTH_PT = 240.96;
const PRINT_STAFF_SPACE_PT = 3.81;
const PRINT_SPACE_ABOVE_PT = 8.36;
const PRINT_SPACE_BELOW_PT = 20.5;
/** One print point in OSMD pixels (OSMD draws a staff space as 10px at zoom 1) */
const PX_PER_PT = 10 / PRINT_STAFF_SPACE_PT;
/** Width the host is given while OSMD lays the sheet out */
const PRINT_HOST_PX = PRINT_BLOCK_WIDTH_PT * PX_PER_PT;
/** Page margins in OSMD units, i.e. what is left of the block beside the system */
const PRINT_SIDE_MARGIN = (PRINT_BLOCK_WIDTH_PT - PRINT_SYSTEM_WIDTH_PT) / 2 / PRINT_STAFF_SPACE_PT;

// Put the sheet on the printed page: its margins, and the system breaks the
// engraver chose. Also collapse the inter-system gap when lyrics are hidden —
// otherwise OSMD leaves the space it would have used for lyrics empty.
function applyEngravingTweaks() {
    if (!osmd) return;
    const rules = (osmd as any).EngravingRules;
    if (!rules) return;
    rules.PageLeftMargin = PRINT_SIDE_MARGIN;
    rules.PageRightMargin = PRINT_SIDE_MARGIN;
    rules.PageTopMargin = PRINT_SPACE_ABOVE_PT / PRINT_STAFF_SPACE_PT;
    rules.PageBottomMargin = PRINT_SPACE_BELOW_PT / PRINT_STAFF_SPACE_PT;
    rules.SystemLeftMargin = 0;
    rules.SystemRightMargin = 0;

    // The converter now writes the book's own breaks as <print new-system>.
    rules.NewSystemAtXMLNewSystemAttribute = true;

    // The lyrics are set at the book's size too. OSMD's own default is 2.0
    // staff spaces; the hymnal sets Optima at 2.7, which is why its lyrics read
    // as large as the verses beside them rather than as a caption under the
    // notes.
    rules.LyricsHeight = 2.7;

    // Honouring the breaks is not enough on its own: OSMD's default note
    // spacing needs more room for a hymn system than Finale used — and lyrics
    // at the book's size need more still — so it splits the requested systems
    // again to make them fit. These lower the width a system must have, not the
    // width it gets: every system is still justified to the full block, so the
    // notes end up spaced as before. Measured over 60 songs, 58 then break
    // exactly where the book breaks them; at OSMD's own spacing only 44 do.
    rules.VoiceSpacingMultiplierVexflow = 0.25;
    rules.VoiceSpacingAddendVexflow = 0.3;

    // With the notes that close together, OSMD's default 0.2 leaves too little
    // between two syllables and words touch. This is a floor, not a spacing:
    // it only widens a note whose lyric needs the room.
    rules.HorizontalBetweenLyricsDistance = 0.9;

    // Finale justifies the closing system whenever the music fills it, which is
    // most songs. Left unstretched it is the one system that shows the tightened
    // spacing raw, and its words end up crowded into the left half.
    rules.StretchLastSystemLine = true;

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

        renderAtPrintGeometry();

        emit('rendered', { lyricsDrawn: lyricsDrawn() });

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

// Whether the engraving on screen sings the words under its notes: the sheet
// has to carry lyrics AND "Liedtext unter Noten" has to ask for them. Reported
// with every render so the page can leave verse 1 out of the list below —
// only the renderer knows both halves of the answer.
function lyricsDrawn(): boolean {
    if (!(props.settings?.showLyrics ?? true)) return false;
    const sheet = osmd?.Sheet;
    if (!sheet) return false;
    return sheet.Instruments.some((instrument) =>
        instrument.Voices.some((voice) =>
            voice.VoiceEntries.some((entry) => entry.LyricsEntries.size() > 0),
        ),
    );
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

// Render on the print block, then hand the result to the column.
//
// OSMD lays out against the width of its host element, so the host is widened
// to the block for the duration of the render and released afterwards; reading
// clientWidth inside render() flushes the style, so the two never race. The
// SVG OSMD writes carries a matching viewBox, so making it fluid scales the
// whole engraving into the column exactly as the Notenbild's own SVG scales —
// which is what puts the two views at the same size.
function renderAtPrintGeometry() {
    if (!osmd || !notationRef.value) return;
    const host = notationRef.value;
    const hostWidth = host.style.width;
    host.style.width = `${PRINT_HOST_PX}px`;
    try {
        osmd.render();
    } finally {
        host.style.width = hostWidth;
    }
    const svg = host.querySelector('svg');
    if (svg) {
        svg.setAttribute('width', '100%');
        svg.removeAttribute('height');
    }
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

// Notengröße deliberately has no watcher: it is the host's width in the
// template, so changing it resizes the drawn engraving without a re-layout —
// and therefore without moving a single system break.

watch(
    () => props.settings,
    () => {
        if (osmd && isInitialized) {
            // setOptions accepts a partial options object
            (osmd as any).setOptions(getOsmdOptions());
            applyEngravingTweaks();
            try {
                renderAtPrintGeometry();
            } catch {
                // No sheet loaded (blob missing/failed) — nothing re-rendered,
                // so there is no state change to announce.
                return;
            }
            // Re-emit after every settings re-render so a successful
            // re-render is reported as such.
            if (osmd.Sheet) {
                emit('rendered', { lyricsDrawn: lyricsDrawn() });
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

<style scoped>
/* Both widths are measured (see the script) and set inline; these are what
   holds until the first measurement lands. */
.notation-scroll,
.notation-canvas {
    width: 100%;
}

/* Centre the engraving in its box. Once it is wider than the box — Notengröße
   past what the page can hold, which only a phone reaches — fall back to a
   plain scroll start: centred overflow would put the first bar of every system
   out of reach to the left, and that is what "safe" prevents. */
.notation-scroll {
    justify-content: center;
    justify-content: safe center;
}
</style>
