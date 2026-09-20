<template>
    <div ref="containerRef" class="notation-col relative w-full">
        <!-- The book's own engraving, and where the melody lives. Everything
             Finale settled while setting the page — the text rows, the system
             breaks, the split bars, the volta brackets, the melisma dashes — is
             already in it, so none of it has to be worked out again here. -->
        <div
            v-if="hasEngraving"
            :class="showOsmd ? BRANCH_OFF : undefined"
            :aria-hidden="showOsmd || undefined"
        >
            <SongMelodyImage
                ref="engravingRef"
                :svg-markup="svgMarkup"
                :image-url="imageUrl"
                :is-loading="imageLoading"
                :scroll-box-style="scrollBoxStyle"
                :canvas-style="canvasStyle"
                :highlight-notes="settings?.highlightNotes ?? true"
                :show-playhead="settings?.showPlayhead ?? true"
                @pick-note="seekToNote"
            />
        </div>

        <!-- The re-set notation. Hidden rather than unmounted while the
             engraving is showing: this is the clock the whole playback runs on,
             and it has to keep its layout so it can be brought back mid-song
             without the music stopping. Hidden through `visibility`, never
             `display`, because OSMD lays a sheet out against its host's
             offsetWidth and a display:none host measures nothing at all. -->
        <div :class="showOsmd ? undefined : BRANCH_OFF" :aria-hidden="!showOsmd || undefined">
            <div
                ref="osmdScrollRef"
                class="notation-scroll flex overflow-x-auto overflow-y-hidden"
                :style="scrollBoxStyle"
            >
                <!-- Below the fit width the sheet is laid out at the printed
                     page's geometry and only then scaled into the column, so the
                     systems break where the book breaks them and the two views
                     agree line for line. Past it there is no width left to scale
                     into, so it is set again on the width there is and fills the
                     box exactly — nothing to scroll sideways to, which is the
                     whole reason for going over.
                     The layer carries that width so the playhead can be measured
                     against it — OSMD owns the canvas below and rewrites it on
                     every render, so nothing of ours may live inside it. -->
                <div
                    ref="layerRef"
                    class="notation-layer relative shrink-0"
                    :style="reflowing ? fittedCanvasStyle : canvasStyle"
                >
                    <div
                        ref="notationRef"
                        class="notation-canvas [&_svg]:h-auto [&_svg]:w-full"
                        @pointercancel="onNotationPointerCancel"
                        @pointerdown="onNotationPointerDown"
                        @pointerup="onNotationPointerUp"
                    ></div>
                    <NotationPlayhead v-if="playhead" ref="osmdPlayheadRef" :box="playhead" />
                </div>
            </div>
        </div>

        <!-- Only worth saying where the re-set notation is what should have been
             on screen. With the engraving showing, the reader has their melody
             and a failed sheet costs them nothing but the transport. -->
        <div
            v-if="renderError && showOsmd"
            class="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive"
        >
            <AlertCircle class="size-5 shrink-0" aria-hidden="true" />
            <span>{{ renderError }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { AlertCircle } from 'lucide-vue-next';
import type { OpenSheetMusicDisplay as OSMDType } from 'opensheetmusicdisplay';
import type PlaybackEngineType from 'osmd-audio-player';

import { midiRouteKey } from '@/composables/useMidiOutput';
import { useNotationScale } from '@/composables/useNotationScale';

import NotationPlayhead from '@/components/songview/NotationPlayhead.vue';
import SongMelodyImage from '@/components/songview/SongMelodyImage.vue';

import type { XmlDisplaySettings } from '@/db';
import type { HymnInstrumentPlayer } from '@/services/instrumentPlayer';
import { type NotationMark, verseForPass } from '@/utils/notationMap';

import { LYRIC_ELONGATION_LIMIT, reserveLyricRoom } from './lyricRoom';
import {
    PRINT_HOST_PX,
    PRINT_SIDE_MARGIN,
    PRINT_SPACE_ABOVE_PT,
    PRINT_SPACE_BELOW_PT,
    PRINT_STAFF_SPACE_PT,
    reflowZoomFor,
} from './notationGeometry';
import { type NoteTarget, TAP_SLOP, noteAtPoint, stepForNote } from './notationHit';
import { type PlayheadBox, type Rect, playheadBox } from './notationPlayhead';
import { REPEAT_ONCE, clampRepeat } from './playbackRepeat';

const props = defineProps<{
    /** The MusicXML sheet — the clock, and the second engraving */
    fileBlob: Blob | null;
    /** Sanitised markup of the book's engraving (`notentext_svg`) */
    svgMarkup: string | null;
    /** Raster fallback for songs cached before notentext_svg was synced */
    imageUrl: string | null;
    imageLoading: boolean;
    scale?: number;
    settings?: XmlDisplaySettings;
    isPlaying?: boolean;
    tempo?: number;
    /** How often the song is played through — 1 is once, Infinity is endless */
    repeat?: number;
    /** Follow the song on screen with nothing to hear */
    muted?: boolean;
    /** Whether a tap on a note may move the music. Off with the transport:
     *  a page read without one has nothing to move, and a Gottesdienst is
     *  read that way. */
    seekable?: boolean;
}>();

const emit = defineEmits<{
    (e: 'playStarted'): void;
    (e: 'playStopped'): void;
    (e: 'ended'): void;
    (e: 'engineLoading', value: boolean): void;
    (e: 'progress', value: { position: number; duration: number }): void;
    (e: 'rendered', info: { lyricsDrawn: boolean }): void;
    (e: 'renderFailed', reason: 'corrupt' | 'engine'): void;
    /** Which of the two is on screen right now */
    (e: 'update:showsEngraving', value: boolean): void;
}>();

defineExpose({ stop: stopPlayback, seek });

const containerRef = ref<HTMLElement | null>(null);
const osmdScrollRef = ref<HTMLElement | null>(null);
const layerRef = ref<HTMLElement | null>(null);
const notationRef = ref<HTMLElement | null>(null);
const osmdPlayheadRef = ref<InstanceType<typeof NotationPlayhead> | null>(null);
const engravingRef = ref<InstanceType<typeof SongMelodyImage> | null>(null);
const renderError = ref<string | null>(null);

/** Off screen but still laid out — see the template. */
const BRANCH_OFF = 'pointer-events-none invisible absolute inset-x-0 top-0';

let osmd: OSMDType | null = null;
let playbackEngine: PlaybackEngineType | null = null;
// Kept beside the engine because muting lives here rather than in the engine:
// osmd-audio-player carries a masterVolume it never applies.
let instrumentPlayer: HymnInstrumentPlayer | null = null;
// The engine's own state enum, kept from the lazy import so its state can be
// read without pulling the module in eagerly. It lives one level down: the
// package's entry point re-exports the engine and nothing else.
let playbackStates: typeof import('osmd-audio-player/dist/PlaybackEngine').PlaybackState | null =
    null;
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

// How wide the drawn melody gets. Measured once for the column and handed to
// both engravings, so one scale means the same thing in either — and so the
// question of whether it still fits is asked once. See useNotationScale.
const { scrollBoxStyle, canvasStyle, fittedCanvasStyle, boxWidth, drawnWidth, overflowsPage } =
    useNotationScale(
        containerRef,
        computed(() => props.scale ?? 1),
    );

// The engraving counts as present while it is still loading, so a song does not
// flash the re-set notation on its way to the page it actually has.
const hasEngraving = computed(() => !!props.svgMarkup || !!props.imageUrl || props.imageLoading);

/**
 * Which of the two is on screen.
 *
 * Below the fit width the engraving wins outright: it is the book's own setting
 * and on a phone it is already 1.56× the printed page. Past it the engraving can
 * only be pushed sideways — a fixed picture cannot re-break — so the reader is
 * handed the one that can, and it does (see `reflowing`).
 *
 * Nothing is asked of the reader here. The engraving is better until it cannot
 * be shown whole, and then it is not; that is a fact about the width, not a
 * matter of taste, and a reader who has just made the notes bigger is telling
 * us they want to read them, not that they want a question. A song with no
 * engraving at all has nothing to choose between, and neither has one whose
 * sheet never arrived.
 */
const showOsmd = computed(() => {
    if (!hasEngraving.value) return true;
    if (!props.fileBlob) return false;
    return overflowsPage.value;
});

/**
 * Whether the sheet is laid out on the width the reader has, rather than on the
 * printed page.
 *
 * This is what „past the fit width" is for. Below it the sheet keeps the book's
 * own system breaks and is scaled, so the two views agree line for line and
 * switching between them moves nothing. Past it that would only push the music
 * off the side of the screen, so the breaks are released and OSMD sets the music
 * again onto the width there actually is — at the note size the scale asks for,
 * which is the whole point of having asked for it.
 */
const reflowing = computed(() => showOsmd.value && overflowsPage.value);

/** The scale the reader set, in the units the layout understands — see
 *  `reflowZoomFor`, which is where that conversion is explained. */
const reflowZoom = computed(() => reflowZoomFor(drawnWidth.value ?? PRINT_HOST_PX));

/** How long the width has to hold still before the sheet is set again on it */
const REFLOW_SETTLE_MS = 160;

let reflowHandle = 0;

/**
 * Set the sheet again whenever the page it is being set on changes.
 *
 * Only while that page is the reader's. On the printed one the geometry is
 * fixed and the scale is a width and nothing more, which is exactly what keeps
 * the two views agreeing line for line below the fit width — letting the scale
 * reach the layout there would move the book's breaks.
 *
 * Debounced, because this is a full re-engraving and the scale arrives from a
 * slider: a drag would otherwise re-set the whole sheet on every frame of it.
 * The key collapses to one value while the printed page is in use, so crossing
 * the fit width re-engraves once in either direction and nothing after that.
 */
watch(
    () =>
        reflowing.value
            ? `${Math.round(boxWidth.value ?? 0)}|${reflowZoom.value.toFixed(3)}`
            : 'print',
    () => {
        if (!osmd || !isInitialized || !osmd.Sheet) return;
        if (reflowHandle) clearTimeout(reflowHandle);
        reflowHandle = window.setTimeout(() => {
            reflowHandle = 0;
            try {
                renderNotation();
            } catch (error) {
                console.error('Could not set the sheet on the new width:', error);
            }
        }, REFLOW_SETTLE_MS);
    },
);

watch(showOsmd, (value) => emit('update:showsEngraving', !value), { immediate: true });

function getOsmdOptions() {
    const s = props.settings;
    // Stated for both themes rather than left to OSMD's default in light
    // mode: setOptions ignores an undefined colour, so an undefined here would
    // leave the dark theme's near-white notes on the light theme's paper.
    const fg = isDarkMode.value ? '#e5e5e5' : '#000000';
    return {
        // The host is sized to the print block for every render (see
        // renderNotation); letting OSMD re-lay-out on resize would measure
        // the column instead, and at the wrong moment.
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
                    renderNotation();
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

// Put the sheet on the page it is being set on: the printed block's margins
// either way (see notationGeometry), and the system breaks the
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

    // The converter writes the book's own breaks as <print new-system>, and they
    // are honoured for as long as the sheet is being set on the printed page.
    // Past the fit width they are exactly what has to go: holding a system that
    // no longer fits is what pushed the music off the side of the screen.
    rules.NewSystemAtXMLNewSystemAttribute = !reflowing.value;

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
    //
    // They are kept when the breaks are released, too, though nothing is being
    // reproduced there any more: they are what the book's own density is worth
    // in OSMD's terms, so a re-break lands on it. Lied 8 at 1.5× comes out at
    // the book's two bars a line; at OSMD's own spacing it goes straight to one.
    rules.VoiceSpacingMultiplierVexflow = 0.25;
    rules.VoiceSpacingAddendVexflow = 0.3;

    // With the notes that close together, OSMD's default 0.2 leaves too little
    // between two syllables and words touch. This is a floor, not a spacing:
    // it only widens a note whose lyric needs the room.
    rules.HorizontalBetweenLyricsDistance = 0.9;

    // How much wider than its notes a measure may be made for its words. OSMD
    // stops at 2.5×, which is plenty against its own spacing but not against
    // the tightened one: with the notes a quarter as close, a bar of four words
    // honestly needs about five. Only past the fit width, where the minimum
    // decides the layout — see lyricRoom, which is what makes the factor come
    // out honest in the first place. On the printed page OSMD's own limit
    // stays, so the tuned breaks stay with it.
    rules.MaximumLyricsElongationFactor = reflowing.value ? LYRIC_ELONGATION_LIMIT : 2.5;

    // How far a bar's last word may hang over the barline. OSMD allows 3.4
    // staff spaces, and a word that long lands on the next bar's first word,
    // which sits right behind the line. Measured over 110 songs at 1.5×, 3.4
    // leaves words touching in 29 of them and 1.0 in 13, for 6% more lines.
    // Again only past the fit width; the printed page keeps OSMD's own.
    rules.LyricOverlapAllowedIntoNextMeasure = reflowing.value ? 1.0 : 3.4;

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

        // OSMD measures every word once, as it lays the sheet out, in the face
        // the options name. Measured before that face has arrived, the words
        // are as wide as the fallback's, and the room they get is wrong for
        // the rest of the song. Nothing to wait for where the font API is
        // missing (tests) or the face fails: the fallback is then the truth.
        await document.fonts?.load?.('1em GbOptima').catch(() => undefined);

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

        renderNotation();

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
            instrumentPlayer = null;
        }
        resetPosition();
        measureSheetClock();
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

// ---------------------------------------------------------------------------
// Where the playback stands
//
// The position is kept in whole notes — the sheet's own clock — and turned
// into seconds only to be shown. A tempo change then moves the scale of that
// clock, not the place in the music: the transport keeps pointing at the same
// note while the time left changes underneath it.
//
// Between two notes the position runs off the wall clock rather than off a
// counter, so a frame the browser skips (a backgrounded tab) is caught up on
// the next one instead of being lost. Every note the engine sounds pegs it
// back to where the music actually is.
// ---------------------------------------------------------------------------

/** Length of the sheet, in whole notes */
let sheetLength = 0;
/** The musical position each of the engine's iteration steps sits at */
let stepPositions: number[] = [];
/** Where the note sounding at each step began, and where the next one begins —
 *  which is the beat the line sweeps, rather than the step it is measured in */
let beatFrom: number[] = [];
let beatTo: number[] = [];
/** Position at the last peg, and the wall clock reading taken with it */
let basePosition = 0;
let baseClock = 0;
let frameHandle = 0;
/** Whether the position is currently running with the music */
let clockRunning = false;
/** A step seeked to before the engine existed, jumped to once it does */
let pendingSeek: number | null = null;
/** Which of those steps is sounding — where the sweeping line starts from */
let currentStep = 0;
/** How many times the song has been played through since it last came to rest.
 *  Counted against `repeat`; a pause and a seek leave it alone, because neither
 *  of them is a pass. */
let passesPlayed = 0;
/** Set between asking the engine to play and its first sounded note */
let awaitingFirstNote = false;
let firstNoteHandle = 0;
/** A note announced but not yet heard — see the ITERATION handler */
let soundingHandle = 0;

/** The run-in of silence the engine's scheduler lays before the first note it
 *  sounds, in whole notes — a fixed 300 of the 1024 ticks it cuts one into. */
const SCHEDULER_LEAD_IN = 300 / 1024;

// ---------------------------------------------------------------------------
// Announced, and heard
//
// The engine announces a note the moment it hands it to the sink, and the
// soundfont's sink hands it to the audio graph — which is not where sound comes
// out. Between the graph and the speaker sits the machine's own buffering, some
// 40ms on a desktop and several times that over Bluetooth, and none of it is in
// the engine's reckoning. Left alone the band and the line therefore run that
// far ahead of the music the whole way down the page: always the same distance,
// always the same direction, and just far enough to see.
//
// So the announcement is held for as long as the sink says its sound takes to
// get out, and everything the reader sees hangs off that later moment. A
// connected instrument reports nothing to wait for and this collapses to what
// it was.
// ---------------------------------------------------------------------------

/** Drop a note that was announced but has not been acted on yet. */
function cancelSounding() {
    if (soundingHandle) clearTimeout(soundingHandle);
    soundingHandle = 0;
}

/** How long one whole note lasts at a tempo — the transport's, by default */
function secondsPerWholeNote(bpm = props.tempo): number {
    return 240 / (bpm || 120);
}

function currentPosition(secondsPerWhole = secondsPerWholeNote()): number {
    if (!clockRunning) return basePosition;
    const played = (performance.now() - baseClock) / 1000 / secondsPerWhole;
    return Math.min(sheetLength, basePosition + played);
}

function syncPosition(position: number) {
    basePosition = Math.max(0, Math.min(sheetLength, position));
    baseClock = performance.now();
}

/** Everything that has to happen once a note is actually heard. */
function noteSounded(position: number | undefined) {
    soundingHandle = 0;
    if (typeof position === 'number') {
        syncPosition(position);
        currentStep = stepForPosition(position);
    }
    if (awaitingFirstNote) startClock();
    showPosition();
}

function emitProgress(position = currentPosition()) {
    emit('progress', {
        position: position * secondsPerWholeNote(),
        duration: sheetLength * secondsPerWholeNote(),
    });
}

function resetPosition() {
    stopClock();
    currentStep = 0;
    passesPlayed = 0;
    syncPosition(0);
    clearHighlight();
    emitProgress(0);
}

// ---------------------------------------------------------------------------
// The bridge from the sheet to the engraving
//
// The map gb-scripts wrote into the Notenbild is keyed by the ordinal of a
// note's <note> in the MusicXML, rests skipped. Nothing in OSMD counts that
// way, so the notes are numbered here in score order and every step the cursor
// walks is matched to its note by object identity.
//
// Two tables come out of that, not one. stepToNote sends both passes of a
// repeat to the same note — which is the point, it IS the same notehead — and
// in doing so throws away exactly what decides which line is sung under it. So
// the visits are counted as well: the second time a note comes round, the
// second verse is the one being sung. Lied 8 is the case that proves it.
// ---------------------------------------------------------------------------

/** The notes in score order — the index is what the Notenbild calls `data-note` */
let notesInOrder: object[] = [];
/** The verse numbers written at each note, ascending (for the re-set notation) */
let versesByNote: string[][] = [];
/** Which note each of the engine's steps sounds, and its pass through it */
let stepToNote: number[] = [];
let stepToVerse: number[] = [];

/** The verse numbers a voice entry carries, ascending. Never the optical row
 *  from the top: a note can carry "2" and "3" without carrying "1". */
function verseNumbersOf(voiceEntry: any): string[] {
    const written: string[] = (voiceEntry?.LyricsEntries?.values?.() ?? [])
        .map((entry: any) => entry?.VerseNumber)
        .filter((verse: unknown): verse is string => typeof verse === 'string' && !!verse);
    return [...new Set(written)].sort((a, b) => Number(a) - Number(b));
}

// Read the sheet's own clock: how long it is, the position of every step the
// engine will walk through — which is what a seek needs to land on a note
// rather than between two — and which note each of those steps sounds.
//
// The positions are ENROLLED, not source, timestamps: a repeat sends the source
// clock backwards halfway through a song, and everything reading it — the
// transport, a seek, the step a position names — would go back with it.
//
// It all comes off the cursor, so this may only run while nothing is playing:
// taking the reading moves it.
function measureSheetClock() {
    const cursor = osmd?.cursor;
    const sheet = osmd?.Sheet;
    if (!sheet || !cursor) return;
    try {
        // Number the notes the way the Notenbild's map numbers them: the order
        // their <note> elements stand in the MusicXML, rests skipped, counted
        // from zero. That order is part by part, then measure by measure, then
        // voice by voice within a measure — which is why the walk below is
        // nested the way it is rather than simply running down the measures.
        // Every mapped song is one part in one voice and the two coincide, but
        // getting it wrong on a song that is not would put the mark on the
        // wrong note for the whole of it.
        const ordinals = new Map<object, number>();
        const order: object[] = [];
        const verses: string[][] = [];
        for (const instrument of sheet.Instruments ?? []) {
            for (const measure of sheet.SourceMeasures ?? []) {
                for (const voice of instrument.Voices ?? []) {
                    for (const container of measure.VerticalSourceStaffEntryContainers ?? []) {
                        for (const staffEntry of container.StaffEntries ?? []) {
                            for (const voiceEntry of staffEntry?.VoiceEntries ?? []) {
                                if (voiceEntry.ParentVoice !== voice) continue;
                                const written = verseNumbersOf(voiceEntry);
                                for (const note of voiceEntry.Notes ?? []) {
                                    if (note.isRest()) continue;
                                    ordinals.set(note, order.length);
                                    order.push(note);
                                    verses.push(written);
                                }
                            }
                        }
                    }
                }
            }
        }

        const positions: number[] = [];
        const toNote: number[] = [];
        const toPass: number[] = [];
        const visits = new Map<number, number>();
        // A rest — or a step the numbering never saw — holds the note before
        // it, so the band simply stays put and covers the silence.
        let heldNote = -1;
        let heldPass = 0;
        let endsAt = 0;

        cursor.reset();
        while (!cursor.Iterator.EndReached) {
            const iterator = cursor.Iterator;
            const position = iterator.CurrentEnrolledTimestamp?.RealValue ?? 0;
            positions.push(position);

            let sounding = -1;
            let length = 0;
            for (const voiceEntry of iterator.CurrentVoiceEntries ?? []) {
                for (const note of voiceEntry.Notes ?? []) {
                    length = Math.max(length, note.Length?.RealValue ?? 0);
                    const ordinal = ordinals.get(note);
                    if (ordinal !== undefined && (sounding < 0 || ordinal < sounding)) {
                        sounding = ordinal;
                    }
                }
            }

            if (sounding < 0) {
                toNote.push(heldNote);
                toPass.push(heldPass);
            } else {
                const pass = visits.get(sounding) ?? 0;
                visits.set(sounding, pass + 1);
                toNote.push(sounding);
                toPass.push(pass);
                heldNote = sounding;
                heldPass = pass;
            }
            endsAt = position + length;
            cursor.next();
        }
        cursor.reset();

        notesInOrder = order;
        versesByNote = verses;
        stepPositions = positions;
        stepToNote = toNote;
        stepToVerse = toPass;
        sheetLength = positions.length ? endsAt : (sheet.SheetEndTimestamp?.RealValue ?? 0);
        measureBeats();
    } catch (error) {
        console.error('Could not measure the sheet:', error);
        sheetLength = 0;
        stepPositions = [];
        beatFrom = [];
        beatTo = [];
        stepToNote = [];
        stepToVerse = [];
        notesInOrder = [];
        versesByNote = [];
    }
    emitProgress();
}

// A beat is one sounding of one note, and it can span several steps: a rest
// after a note belongs to it, because the band goes on covering the silence.
// The line sweeps that whole span, so it reaches the next notehead exactly as
// the band moves on instead of restarting partway.
function measureBeats() {
    const steps = stepPositions.length;
    beatFrom = new Array(steps);
    beatTo = new Array(steps);
    let began = 0;
    for (let step = 0; step < steps; step++) {
        if (step > 0 && !sameBeat(step - 1, step)) began = step;
        beatFrom[step] = stepPositions[began];
    }
    let ends = sheetLength;
    for (let step = steps - 1; step >= 0; step--) {
        if (step < steps - 1 && !sameBeat(step, step + 1)) ends = beatFrom[step + 1];
        beatTo[step] = ends;
    }
}

function sameBeat(a: number, b: number): boolean {
    return stepToNote[a] === stepToNote[b] && stepToVerse[a] === stepToVerse[b];
}

// Hand the start of the clock to the engine: the music begins on the note it
// sounds, not on the tap that asked for it. Its scheduler lays a run-in of
// silence before that first note, so a clock started at the tap would sweep
// the whole of the first beat during the silence and then be pegged back to
// the beginning when the note finally arrives — playing that beat twice.
//
// The deadline behind it is only a safety line. An engine with no step left to
// announce — resumed on the last note of the sheet — would never sound one,
// and the clock is what notices that the sheet has ended, so it may not be
// left waiting forever.
function startClockOnFirstNote() {
    awaitingFirstNote = true;
    if (firstNoteHandle) clearTimeout(firstNoteHandle);
    firstNoteHandle = window.setTimeout(
        () => {
            if (!awaitingFirstNote) return;
            cancelFirstNoteWait();
            startClock();
        },
        (SCHEDULER_LEAD_IN * secondsPerWholeNote() + 0.5) * 1000,
    );
}

function cancelFirstNoteWait() {
    awaitingFirstNote = false;
    if (firstNoteHandle) clearTimeout(firstNoteHandle);
    firstNoteHandle = 0;
}

function startClock() {
    cancelFirstNoteWait();
    if (clockRunning) return;
    clockRunning = true;
    baseClock = performance.now();
    const tick = () => {
        frameHandle = requestAnimationFrame(tick);
        const position = currentPosition();
        sweepPlayheadLine(position);
        emitProgress(position);
        if (sheetLength > 0 && position >= sheetLength) reachedEnd();
    };
    frameHandle = requestAnimationFrame(tick);
}

function stopClock() {
    cancelFirstNoteWait();
    // A note announced but not yet heard must not land after the music has
    // been stopped, or it would put the mark back on a song at rest.
    cancelSounding();
    if (frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    if (clockRunning) {
        basePosition = currentPosition();
        clockRunning = false;
    }
}

// The engine plays a score to its end and then simply keeps ticking — nothing
// in it knows the sheet is over. The clock does, so the ending is ours to act
// on: either go round again, or come to rest at the beginning.
//
// How often is counted in passes, not in repeats: the reader asked for four
// because there are four verses, and the fourth one ends the song. The count
// is kept here rather than in the transport because the decision has to be
// made in the same tick the sheet runs out — a parent told about it would
// answer one render too late, with the music already ticking past the end.
function reachedEnd() {
    stopClock();
    passesPlayed++;
    if (passesPlayed < clampRepeat(props.repeat ?? REPEAT_ONCE)) {
        restartPlayback();
        return;
    }
    // Only now is the song over. Anything listening for the end — the
    // transport coming back to rest, the lock screen — means this moment, not
    // the end of a verse with another one owed.
    emit('ended');
    stopPlayback();
}

async function restartPlayback() {
    if (!playbackEngine) return;
    try {
        await playbackEngine.stop();
        clearHighlight();
        currentStep = 0;
        syncPosition(0);
        emitProgress(0);
        await playbackEngine.play();
        startClockOnFirstNote();
    } catch (error) {
        console.error('OSMD loop restart error:', error);
        stopPlayback();
    }
}

/** Jump to a fraction (0..1) of the sheet. */
async function seek(fraction: number) {
    if (!stepPositions.length) return;
    const target = Math.max(0, Math.min(1, fraction)) * sheetLength;
    await jumpTo(stepForPosition(target));
}

/**
 * Jump to a note the reader tapped on the page.
 *
 * The note is all the engraving can say — one notehead is one note however
 * often it is sung — so which time through it is decided here, and decided as
 * the nearest one: a tap just ahead of the mark means the pass being sung, not
 * the first pass of a song already on its second time round.
 */
async function seekToNote(note: number) {
    if (props.seekable === false) return;
    const step = stepForNote(stepToNote, note, currentStep);
    if (step !== null) await jumpTo(step);
}

async function jumpTo(step: number) {
    if (!stepPositions.length) return;

    if (!playbackEngine) {
        // The soundfont has never been fetched, so there is nothing to jump in
        // yet. The engraving can still follow: walk the cursor there, mark the
        // note, and keep the step so the first play tap starts on it.
        //
        // Settled before it is shown, in that order: the mark is drawn from
        // where the music stands, so drawing it first draws the step the reader
        // asked for last time — a mark one tap behind the finger.
        pendingSeek = step;
        settleAt(step);
        moveCursorToStep(step);
        showPosition();
        return;
    }

    // A seek during the run-in before the first note is a seek in a song that
    // is playing, even though its clock has not started yet.
    const wasPlaying = clockRunning || awaitingFirstNote;
    stopClock();
    // jumpToStep pauses the engine and points its scheduler at the step —
    // patched to sound that step first; see patches/osmd-audio-player.
    playbackEngine.jumpToStep(step);
    settleAt(step);
    showPosition();
    if (wasPlaying) {
        try {
            await playbackEngine.play();
            startClockOnFirstNote();
        } catch (error) {
            console.error('OSMD playback error:', error);
            emit('playStopped');
        }
    }
}

/** The last iteration step that has begun by the given musical position */
function stepForPosition(target: number): number {
    let step = 0;
    while (step + 1 < stepPositions.length && stepPositions[step + 1] <= target + 1e-6) step++;
    return step;
}

/** Come to rest on a step: the transport reads the note's own position, not
 *  the one that was pointed at somewhere between two notes. */
function settleAt(step: number) {
    currentStep = step;
    syncPosition(stepPositions[step] ?? 0);
    emitProgress(stepPositions[step] ?? 0);
}

/** Walk the engine's cursor to a step, and no more than that: what the reader
 *  sees is `showPosition`'s errand, and it has to come after the step is settled. */
function moveCursorToStep(step: number) {
    const cursor = osmd?.cursor;
    if (!cursor) return;
    cursor.reset();
    for (let i = 0; i < step; i++) cursor.next();
}

// ---------------------------------------------------------------------------
// What the playback looks like
//
// One mark, two engravings. Which note is sounding and which pass through it
// this is comes out of the tables above and out of nothing else, so both
// drawings light the same note and the same line of text — and a switch from
// one to the other mid-song moves nothing.
//
// OSMD's own cursor plays no part: it is an image laid out in the print block's
// pixels while the engraving on screen is that block scaled into the column, so
// it can only land beside the note. The mark is drawn in the terms the page is
// already written in — the sounding note and its syllable take the flourish
// colour, and a band behind the staff covers the beat from this note up to
// where the next one starts.
// ---------------------------------------------------------------------------

const ACTIVE_CLASS = 'gb-play-active';

const playhead = ref<PlayheadBox | null>(null);

let osmdNotes: SVGGElement[] = [];
let osmdLitNotes: Element[] = [];
let osmdLitLyrics: Element[] = [];
let osmdSystem: Element | null = null;
// Whether a mark belongs on the page at all. The cursor sits on the first note
// from the moment a sheet is loaded, so without this a re-engraving — a
// setting toggled, the theme switched — would light that note up on a song
// nobody has played yet.
let marked = false;

function clearOsmdInk() {
    for (const element of osmdLitNotes) element.classList.remove(ACTIVE_CLASS);
    for (const element of osmdLitLyrics) element.classList.remove(ACTIVE_CLASS);
    osmdLitNotes = [];
    osmdLitLyrics = [];
}

function clearHighlight() {
    clearOsmdInk();
    osmdNotes = [];
    osmdSystem = null;
    marked = false;
    playhead.value = null;
    engravingRef.value?.clearMark();
}

/** Put the mark back where it was, if there is one to put back. */
function refreshMark() {
    if (marked) showPosition();
}

/** Where the music stands, in the map's own terms — or null where the sheet
 *  could not be mapped, which is when the cursor has to answer for itself. */
function markAt(step: number): NotationMark | null {
    const note = stepToNote[step];
    if (note === undefined || note < 0) return null;
    return { note, pass: stepToVerse[step] ?? 0, follow: false };
}

/** Mark where the music stands, on whichever engraving is showing. */
function showPosition() {
    marked = true;
    const at = markAt(currentStep);
    // The run-in counts as playing: the mark lands on the first note before the
    // clock starts, and that is exactly the beat to bring into view.
    const running = clockRunning || awaitingFirstNote;
    engravingRef.value?.mark(at ? { ...at, follow: running && !showOsmd.value } : null);
    markOnOsmd(at, running && showOsmd.value);
}

/** What the re-set notation drew for a note of the score, if it drew one. The
 *  map it is looked up in is rebuilt on every render, so a note from before one
 *  simply is not in it. */
function graphicalFor(note: object | undefined): any {
    if (!note) return null;
    try {
        return (osmd as any)?.rules?.GNote?.(note) ?? null;
    } catch {
        return null;
    }
}

/** The graphical notes to mark in the re-set notation: the one the map names,
 *  or — where the sheet could not be mapped — whatever the cursor stands on. */
function graphicalNotesAt(at: NotationMark | null): any[] {
    const graphical = at ? graphicalFor(notesInOrder[at.note]) : null;
    if (graphical) return [graphical];
    try {
        return osmd?.cursor?.GNotesUnderCursor() ?? [];
    } catch {
        // Cursor sitting past the end of the sheet — nothing to mark.
        return [];
    }
}

function markOnOsmd(at: NotationMark | null, follow: boolean) {
    // The notes are collected either way — the band is measured off them, so it
    // can be shown with the colouring turned off.
    const colour = props.settings?.highlightNotes ?? true;
    for (const element of osmdLitNotes) element.classList.remove(ACTIVE_CLASS);
    osmdLitNotes = [];
    osmdNotes = [];
    if (!colour) {
        for (const element of osmdLitLyrics) element.classList.remove(ACTIVE_CLASS);
        osmdLitLyrics = [];
    }

    // The line the Notenbild would light, chosen the same way — off the numbers
    // written at this note, in the order they are written. Null means the sheet
    // carries no lyrics to choose between, and then every row is lit.
    const verse = at ? verseForPass(versesByNote[at.note] ?? [], at.pass) : null;
    const sung: Element[] = [];

    for (const graphical of graphicalNotesAt(at)) {
        const element: SVGGElement | undefined = graphical.getSVGGElement?.();
        if (element) {
            osmdNotes.push(element);
            if (colour) {
                element.classList.add(ACTIVE_CLASS);
                osmdLitNotes.push(element);
            }
        }
        if (!colour) continue;
        for (const lyric of graphical.parentVoiceEntry?.parentStaffEntry?.LyricsEntries ?? []) {
            const node = lyric?.GraphicalLabel?.SVGNode as Element | undefined;
            if (!node) continue;
            if (verse !== null && lyric.LyricsEntry?.VerseNumber !== verse) continue;
            sung.push(node);
        }
    }

    // Nothing written at this note means a syllable is being held across it.
    // The word already lit stays lit; clearing it would blank the text for the
    // length of the melisma.
    if (colour && sung.length) {
        for (const element of osmdLitLyrics) element.classList.remove(ACTIVE_CLASS);
        osmdLitLyrics = sung;
        for (const element of sung) element.classList.add(ACTIVE_CLASS);
    }

    updateOsmdBand(at, follow);
}

function updateOsmdBand(at: NotationMark | null, follow: boolean) {
    const layer = layerRef.value;
    if (!layer || !osmdNotes.length || !(props.settings?.showPlayhead ?? true)) {
        playhead.value = null;
        return;
    }
    // A system is one staffline per staff, so a grand staff contributes two:
    // the band spans all of them, the way one beat runs down the whole system.
    const systems = new Set<Element>();
    for (const note of osmdNotes) {
        const system = note.closest('g.staffline');
        if (system) systems.add(system);
    }
    const firstSystem = systems.values().next().value;
    if (!firstSystem) {
        playhead.value = null;
        return;
    }

    let left = Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let right = -Infinity;
    for (const staffline of systems) {
        const rect = staffline.getBoundingClientRect();
        left = Math.min(left, rect.left);
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
        right = Math.max(right, rect.right);
    }
    const bounds: Rect = { left, right, top, bottom, height: bottom - top };

    const sameSystem = firstSystem === osmdSystem;
    osmdSystem = firstSystem;
    playhead.value = playheadBox(
        layer.getBoundingClientRect(),
        bounds,
        osmdNotes.map((note) => note.getBoundingClientRect()),
        osmdNeighbour(at, firstSystem)?.getBoundingClientRect() ?? null,
        sameSystem,
    );

    if (follow) followOsmd(!sameSystem);
    // The element is created by the box above, so it only exists a tick later.
    nextTick(() => sweepPlayheadLine());
}

/** The notehead the band runs to, within this staffline: the one printed after
 *  this note, which over a repeat is not the one sung after it — see
 *  `playheadBox`. Where the sheet could not be mapped there is no ordinal to
 *  ask for, so document order answers instead — a second staff is written out
 *  as its own staffline after the first, so that order is only musical order
 *  inside one. */
function osmdNeighbour(at: NotationMark | null, system: Element): Element | null {
    if (!at) {
        const drawn = Array.from(system.querySelectorAll('g.vf-stavenote'));
        const index = drawn.indexOf(osmdNotes[0]);
        return index < 0 ? null : (drawn[index + 1] ?? null);
    }
    const element: Element | undefined = graphicalFor(
        notesInOrder[at.note + 1],
    )?.getSVGGElement?.();
    if (!element) return null;
    // One on another system does not bound this beat — there the beat runs to
    // the end of its own system.
    return element.closest('g.staffline') === system ? element : null;
}

// ---------------------------------------------------------------------------
// Tapping the re-set notation
//
// The same errand as on the Notenbild, answered in the same terms — a note
// ordinal, which `seekToNote` turns into a pass. What differs is only where the
// noteheads come from: there they are named in the map, here they have to be
// asked of OSMD's own layout.
// ---------------------------------------------------------------------------

let notationTapFrom: { x: number; y: number } | null = null;

function onNotationPointerDown(event: PointerEvent) {
    notationTapFrom = { x: event.clientX, y: event.clientY };
}

function onNotationPointerCancel() {
    notationTapFrom = null;
}

function onNotationPointerUp(event: PointerEvent) {
    const from = notationTapFrom;
    notationTapFrom = null;
    if (!from) return;
    // Dragging is how a wide sheet is scrolled sideways, and a drag ends in a
    // pointerup like any other. Only one that stayed put is asking for a note.
    if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP) return;

    // A sheet that could not be measured offers no targets, and that is the
    // whole guard: there is nothing to tap on music the playback cannot follow.
    const note = noteAtPoint(event.clientX, event.clientY, notationTargets());
    if (note !== null) void seekToNote(note);
}

/** Every note that can be tapped, with the staffline it stands in. Measured at
 *  the tap rather than kept: OSMD rewrites this canvas on every render, and the
 *  sheet scrolls inside its box. */
function notationTargets(): NoteTarget[] {
    const rows = new Map<Element, Rect>();
    const targets: NoteTarget[] = [];
    for (let note = 0; note < notesInOrder.length; note++) {
        const element: Element | undefined = graphicalFor(notesInOrder[note])?.getSVGGElement?.();
        const staffline = element?.closest('g.staffline');
        if (!element || !staffline) continue;
        let row = rows.get(staffline);
        if (!row) {
            row = staffline.getBoundingClientRect();
            rows.set(staffline, row);
        }
        targets.push({ note, head: element.getBoundingClientRect(), system: row });
    }
    return targets;
}

// Where the music stands *between* two notes.
//
// The band can only move a note at a time — it marks which note is sounding.
// This line carries the time inside that note: it crosses the notehead as the
// note is struck and reaches the next one exactly as the band moves on, so the
// two never disagree and the motion never breaks. Both engravings are swept,
// the hidden one included, so the one brought back mid-song is already right.
function sweepPlayheadLine(position = currentPosition()) {
    const from = beatFrom[currentStep] ?? 0;
    const to = beatTo[currentStep] ?? sheetLength;
    const span = to - from;
    const played = span > 0 ? Math.min(1, Math.max(0, (position - from) / span)) : 0;
    osmdPlayheadRef.value?.sweep(played);
    engravingRef.value?.sweep(played);
}

// Keep the beat in view. Vertically only when it reaches a new system, so
// following never fights a reader scrolling the page themselves; sideways
// whenever the drawing is wider than the box showing it, because there the
// music leaves the screen within a single system.
function followOsmd(systemChanged: boolean) {
    const box = osmdScrollRef.value;
    const sideways = !!box && box.scrollWidth > box.clientWidth + 1;
    if (!systemChanged && !sideways) return;
    nextTick(() => {
        osmdPlayheadRef.value?.bringIntoView({
            block: 'nearest',
            inline: sideways ? 'center' : 'nearest',
        });
    });
}

// Drop the engine and, with it, whatever it was sounding through. A MIDI
// instrument has to be told: notes already queued on the device would go on
// playing — and a note-on whose note-off was dropped holds forever.
async function disposeEngine() {
    cancelSounding();
    if (playbackEngine) {
        try {
            await playbackEngine.stop();
        } catch {
            // ignore
        }
    }
    instrumentPlayer?.dispose?.();
    playbackEngine = null;
    instrumentPlayer = null;
}

async function initPlayback() {
    if (!osmd) return;

    await disposeEngine();

    // Held locally as well: if construction fails after the sink exists, the
    // field is still null and only this reference can release it.
    let player: HymnInstrumentPlayer | null = null;
    try {
        const { default: PlaybackEngine } = await import('osmd-audio-player');
        const { PlaybackEvent, PlaybackState } =
            await import('osmd-audio-player/dist/PlaybackEngine');
        playbackStates = PlaybackState;
        const { AudioContext } = await import('standardized-audio-context');
        const { createInstrumentPlayer } = await import('@/services/instrumentPlayer');
        // Either the precached local soundfont (no third-party request) or a
        // connected MIDI instrument — the engine above cannot tell the two apart.
        player = await createInstrumentPlayer();
        player.setMuted(!!props.muted);
        const engine = new PlaybackEngine(new AudioContext(), player);
        await engine.loadScore(osmd as any);
        if (props.tempo) {
            engine.setBpm(props.tempo);
        }
        // Every note the engine hands to the sink is announced here — which is
        // what moves the mark on the page, pegs the clock to the real position,
        // and, on the first note of a run, is what sets the clock going at all.
        // Handed over is not heard, though, so all of it waits out the sink's
        // own latency first.
        engine.on(PlaybackEvent.ITERATION, () => {
            // Read here and carried into the wait rather than read again inside
            // it: this is where the cursor stands on the note being announced.
            //
            // Enrolled, like the table it is looked up in: on the second pass
            // of a repeat the source timestamp names the first pass's step, and
            // with it the first verse — under notes that are singing the second.
            const position = osmd?.cursor?.Iterator?.CurrentEnrolledTimestamp?.RealValue;
            // Read now rather than cached: an instrument plugged in mid-song
            // changes the answer, and so does a machine switching output.
            const heardIn = player?.outputLatency?.() ?? 0;
            cancelSounding();
            if (heardIn > 0.005) {
                soundingHandle = window.setTimeout(() => noteSounded(position), heardIn * 1000);
            } else {
                noteSounded(position);
            }
        });
        playbackEngine = engine;
        instrumentPlayer = player;
    } catch (error) {
        console.error('Failed to init OSMD audio player:', error);
        // Audio failure should not block visual rendering
        player?.dispose?.();
        playbackEngine = null;
        instrumentPlayer = null;
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
function renderNotation() {
    if (!osmd || !notationRef.value) return;
    const host = notationRef.value;
    const hostWidth = host.style.width;
    // Which page the sheet is being set on — the printed one, or the reader's.
    // The rules have to be restated either way: whether the book's breaks are
    // honoured is part of them, and it changes with the width.
    applyEngravingTweaks();
    const onReadersPage = reflowing.value;
    // Past the fit width the words have to be allowed to widen their measures
    // for real; on the printed page the book's breaks make that moot.
    reserveLyricRoom(osmd, onReadersPage);
    (osmd as unknown as { zoom: number }).zoom = onReadersPage ? reflowZoom.value : 1;
    host.style.width = `${onReadersPage ? (boxWidth.value ?? PRINT_HOST_PX) : PRINT_HOST_PX}px`;
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
    // Every element the mark hung on has just been replaced. Hang it back on
    // where the music stands, so a re-engraving mid-song goes unnoticed.
    osmdLitNotes = [];
    osmdLitLyrics = [];
    osmdNotes = [];
    osmdSystem = null;
    if (osmd.Sheet) refreshMark();
}

async function startPlayback() {
    const token = ++playRequestToken;
    if (!playbackEngine) {
        // Lazy engine construction on the first play tap — inside the user
        // gesture, which also satisfies the browser autoplay policy.
        // Concurrent callers share one in-flight init instead of each
        // building their own engine. It takes seconds, so the transport is
        // told to show that the tap was heard.
        emit('engineLoading', true);
        initPromise ??= initPlayback().finally(() => {
            initPromise = null;
        });
        try {
            await initPromise;
        } finally {
            emit('engineLoading', false);
        }
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
    if (pendingSeek !== null) {
        // Loading the score reset the cursor the seek had moved — put it back
        // on the step the reader chose before the first note sounds.
        playbackEngine.jumpToStep(pendingSeek);
        settleAt(pendingSeek);
        pendingSeek = null;
    }
    try {
        await playbackEngine.play();
        startClockOnFirstNote();
        showPosition();
        emit('playStarted');
    } catch (error) {
        console.error('OSMD playback error:', error);
        emit('playStopped');
    }
}

function pausePlayback() {
    if (!playbackEngine) return;
    // The song may have run out on its own a moment ago, and the parent is
    // only now following with isPlaying=false. Pausing an engine that already
    // stopped would leave it PAUSED at step zero — a state the next play tap
    // then has to dig itself out of.
    if (playbackStates && playbackEngine.state !== playbackStates.PLAYING) return;
    stopClock();
    emitProgress();
    try {
        playbackEngine.pause();
    } catch (error) {
        console.error('OSMD pause error:', error);
    }
}

async function stopPlayback() {
    stopClock();
    if (playbackEngine) {
        try {
            await playbackEngine.stop();
        } catch (error) {
            console.error('OSMD stop error:', error);
        }
    }
    pendingSeek = null;
    resetPosition();
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

// Notengröße deliberately has no watcher: it is the layer's width in the
// template, so changing it resizes the drawn engraving without a re-layout —
// and therefore without moving a single system break. The band does have to
// follow it, and the layer's ResizeObserver is what makes it.

// Only the settings the engraving is laid out from may re-render it. The two
// playback marks are drawn over the finished engraving, so toggling one must
// not cost a re-engraving — nor move a system break mid-song.
//
// Watched as one string rather than as a pair: the store hands over a new
// settings object on every change, and a getter returning a fresh array is
// never equal to the last one, so an array here would re-render on all four.
watch(
    () => `${props.settings?.showMeasureNumbers}|${props.settings?.showLyrics}`,
    () => {
        if (osmd && isInitialized) {
            // setOptions accepts a partial options object
            (osmd as any).setOptions(getOsmdOptions());
            try {
                renderNotation();
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
);

watch(
    () => `${props.settings?.highlightNotes}|${props.settings?.showPlayhead}`,
    () => refreshMark(),
);

// The renderers swap without the music noticing — the engine, the clock and the
// tables all live here and none of them is touched. What does have to happen is
// a fresh measurement: the layer that was folded away is now in the flow, so
// every rectangle the band was built from has moved.
watch(showOsmd, () => nextTick(() => refreshMark()));

watch(
    () => props.tempo,
    (newTempo, oldTempo) => {
        // Peg the clock before the scale under it changes, and read what is
        // still unpegged at the tempo it was played at — measuring it at the
        // new one would move the position along with the tempo.
        const position = currentPosition(secondsPerWholeNote(oldTempo));
        syncPosition(position);
        if (playbackEngine && newTempo) {
            playbackEngine.setBpm(newTempo);
        }
        emitProgress(position);
    },
);

watch(
    () => props.muted,
    (muted) => {
        instrumentPlayer?.setMuted(!!muted);
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

// The instrument was switched, plugged in or unplugged. The engine holds its
// sink for life, so it has to go; the next play tap builds one on the new
// route. Rebuilding silently mid-song would be worse than stopping — the
// reader would hear the hymn restart from an unknown place.
watch(midiRouteKey, async () => {
    if (!playbackEngine) return;
    if (props.isPlaying) emit('playStopped');
    await disposeEngine();
});

let layerObserver: ResizeObserver | null = null;

onMounted(() => {
    initOsmd();
    if (layerRef.value) {
        layerObserver = new ResizeObserver(() => refreshMark());
        layerObserver.observe(layerRef.value);
    }
});

onBeforeUnmount(async () => {
    stopClock();
    if (reflowHandle) {
        clearTimeout(reflowHandle);
        reflowHandle = 0;
    }
    if (layerObserver) {
        layerObserver.disconnect();
        layerObserver = null;
    }
    if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
    }
    await disposeEngine();
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
.notation-layer,
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

/* A tap moves the music to the note under it — offered only once OSMD has
   actually drawn notes to tap, which is asked of the canvas rather than kept
   beside it, so it cannot fall out of step with what the tap will find. */
.notation-canvas:has(g.vf-stavenote) {
    cursor: pointer;
}

/* Own stacking context, so the band behind the engraving stops there instead
   of falling through to the page's own background and disappearing. */
.notation-layer {
    isolation: isolate;
}

/* OSMD's own cursor is laid out in the print block's pixels while the
   engraving on screen is that block scaled down, so it can only land in the
   wrong place. The band below replaces it. */
.notation-layer :deep(img[id^='cursorImg']) {
    display: none !important;
}

/* The sounding notes and the syllable under them, in the flourish colour.
   Noteheads, rests and dots are filled while stems and ledger lines are
   stroked, so colouring either way round alone would leave half the note
   behind. */
.notation-canvas :deep(.gb-play-active) {
    transition:
        fill 90ms linear,
        stroke 90ms linear;
}

.notation-canvas :deep(.gb-play-active .vf-notehead path),
.notation-canvas :deep(.gb-play-active .vf-modifiers path),
.notation-canvas :deep(.gb-play-active .vf-flag path),
.notation-canvas :deep(text.gb-play-active),
.notation-canvas :deep(.gb-play-active > text) {
    fill: var(--gold);
}

.notation-canvas :deep(.gb-play-active .vf-stem path),
.notation-canvas :deep(.gb-play-active .vf-ledger path) {
    stroke: var(--gold);
}
</style>
