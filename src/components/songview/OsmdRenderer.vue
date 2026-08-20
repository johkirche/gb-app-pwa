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
                 picture; it must not reach the layout, or the breaks move.
                 The layer carries that width so the playhead can be measured
                 against it — OSMD owns the canvas below and rewrites it on
                 every render, so nothing of ours may live inside it. -->
            <div ref="layerRef" class="notation-layer relative shrink-0" :style="canvasStyle">
                <div ref="notationRef" class="notation-canvas [&_svg]:h-auto [&_svg]:w-full"></div>
                <div
                    v-if="playhead"
                    ref="playheadRef"
                    class="playhead"
                    :style="playheadStyle"
                    aria-hidden="true"
                ></div>
                <div
                    v-if="playhead"
                    ref="playheadLineRef"
                    class="playhead-line"
                    :style="{ top: `${playhead.top}px`, height: `${playhead.height}px` }"
                    aria-hidden="true"
                ></div>
            </div>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { AlertCircle } from 'lucide-vue-next';
import type { OpenSheetMusicDisplay as OSMDType } from 'opensheetmusicdisplay';
import type PlaybackEngineType from 'osmd-audio-player';

import { useNotationScale } from '@/composables/useNotationScale';

import type { XmlDisplaySettings } from '@/db';
import type { LocalSoundfontPlayer as LocalSoundfontPlayerType } from '@/services/localSoundfontPlayer';

const props = defineProps<{
    fileBlob: Blob | null;
    scale?: number;
    settings?: XmlDisplaySettings;
    isPlaying?: boolean;
    tempo?: number;
    loop?: boolean;
    /** Follow the song on screen with nothing to hear */
    muted?: boolean;
}>();

const emit = defineEmits<{
    (e: 'playStarted'): void;
    (e: 'playStopped'): void;
    (e: 'ended'): void;
    (e: 'engineLoading', value: boolean): void;
    (e: 'progress', value: { position: number; duration: number }): void;
    (e: 'rendered', info: { lyricsDrawn: boolean }): void;
    (e: 'renderFailed', reason: 'corrupt' | 'engine'): void;
}>();

defineExpose({ stop: stopPlayback, seek });

const containerRef = ref<HTMLElement | null>(null);
const layerRef = ref<HTMLElement | null>(null);
const notationRef = ref<HTMLElement | null>(null);
const playheadRef = ref<HTMLElement | null>(null);
const playheadLineRef = ref<HTMLElement | null>(null);
const renderError = ref<string | null>(null);

let osmd: OSMDType | null = null;
let playbackEngine: PlaybackEngineType | null = null;
// Kept beside the engine because muting lives here rather than in the engine:
// osmd-audio-player carries a masterVolume it never applies.
let instrumentPlayer: LocalSoundfontPlayerType | null = null;
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

// How wide the drawn engraving gets. Shared with the Notenbild so one scale
// means the same thing in either view — see useNotationScale.
const { scrollBoxStyle, canvasStyle } = useNotationScale(
    containerRef,
    computed(() => props.scale ?? 1),
);

function getOsmdOptions() {
    const s = props.settings;
    // Stated for both themes rather than left to OSMD's default in light
    // mode: setOptions ignores an undefined colour, so an undefined here would
    // leave the dark theme's near-white notes on the light theme's paper.
    const fg = isDarkMode.value ? '#e5e5e5' : '#000000';
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

function emitProgress(position = currentPosition()) {
    emit('progress', {
        position: position * secondsPerWholeNote(),
        duration: sheetLength * secondsPerWholeNote(),
    });
}

function resetPosition() {
    stopClock();
    currentStep = 0;
    syncPosition(0);
    clearHighlight();
    emitProgress(0);
}

// Read the sheet's own clock: how long it is, and the position of every step
// the engine will walk through — which is what a seek needs to land on a note
// rather than between two. Both come off the cursor, so this may only run
// while nothing is playing: taking the reading moves it.
function measureSheetClock() {
    const cursor = osmd?.cursor;
    if (!osmd?.Sheet || !cursor) return;
    try {
        sheetLength = osmd.Sheet.SheetEndTimestamp?.RealValue ?? 0;
        const positions: number[] = [];
        cursor.reset();
        while (!cursor.Iterator.EndReached) {
            positions.push(cursor.Iterator.CurrentSourceTimestamp?.RealValue ?? 0);
            cursor.next();
        }
        cursor.reset();
        stepPositions = positions;
    } catch (error) {
        console.error('Could not measure the sheet:', error);
        sheetLength = 0;
        stepPositions = [];
    }
    emitProgress();
}

function startClock() {
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
function reachedEnd() {
    stopClock();
    emit('ended');
    if (props.loop) {
        restartPlayback();
    } else {
        stopPlayback();
    }
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
        startClock();
    } catch (error) {
        console.error('OSMD loop restart error:', error);
        stopPlayback();
    }
}

/** Jump to a fraction (0..1) of the sheet. */
async function seek(fraction: number) {
    if (!stepPositions.length) return;
    const target = Math.max(0, Math.min(1, fraction)) * sheetLength;
    const step = stepForPosition(target);

    if (!playbackEngine) {
        // The soundfont has never been fetched, so there is nothing to jump in
        // yet. The engraving can still follow: walk the cursor there, mark the
        // note, and keep the step so the first play tap starts on it.
        pendingSeek = step;
        moveCursorToStep(step);
        settleAt(step);
        return;
    }

    const wasPlaying = clockRunning;
    stopClock();
    // jumpToStep pauses the engine and walks the cursor to the step.
    playbackEngine.jumpToStep(step);
    settleAt(step);
    showCursorPosition();
    if (wasPlaying) {
        try {
            await playbackEngine.play();
            startClock();
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

function moveCursorToStep(step: number) {
    const cursor = osmd?.cursor;
    if (!cursor) return;
    cursor.reset();
    for (let i = 0; i < step; i++) cursor.next();
    showCursorPosition();
}

// ---------------------------------------------------------------------------
// What the playback looks like
//
// OSMD's own cursor is an image laid out in the print block's pixels, while
// the engraving on screen is that block scaled into the column — so it lands
// anywhere but on the note. The mark is drawn here instead, and in the terms
// the page is already written in: the sounding notes and the syllable under
// them take the flourish colour, and a band behind the staff covers the beat
// from this note up to where the next one starts.
// ---------------------------------------------------------------------------

const ACTIVE_CLASS = 'gb-play-active';
/** Air kept around the band, as a share of the system's height */
const PLAYHEAD_GAP_RATIO = 0.035;

interface PlayheadBox {
    left: number;
    top: number;
    width: number;
    height: number;
    /** Where the sweeping line crosses when this beat starts and when the next one does */
    from: number;
    to: number;
    /** False when the band lands on another system — sliding there reads as noise */
    animate: boolean;
}

const playhead = ref<PlayheadBox | null>(null);
const playheadStyle = computed(() => {
    const box = playhead.value;
    if (!box) return {};
    return {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        transitionDuration: box.animate ? '' : '0s',
    };
});

let activeElements: Element[] = [];
let activeNotes: SVGGElement[] = [];
let activeSystem: Element | null = null;
// Whether a mark belongs on the page at all. The cursor sits on the first note
// from the moment a sheet is loaded, so without this a re-engraving — a
// setting toggled, the theme switched — would light that note up on a song
// nobody has played yet.
let marked = false;

function clearHighlight() {
    for (const element of activeElements) element.classList.remove(ACTIVE_CLASS);
    activeElements = [];
    activeNotes = [];
    activeSystem = null;
    marked = false;
    playhead.value = null;
}

/** Put the mark back where it was, if there is one to put back. */
function refreshMark() {
    if (marked) showCursorPosition();
}

/** Mark whatever the cursor now stands on. */
function showCursorPosition() {
    const cursor = osmd?.cursor;
    if (!cursor) return;
    marked = true;
    for (const element of activeElements) element.classList.remove(ACTIVE_CLASS);
    activeElements = [];
    activeNotes = [];

    let graphicalNotes: any[] = [];
    try {
        graphicalNotes = cursor.GNotesUnderCursor();
    } catch {
        // Cursor sitting past the end of the sheet — nothing to mark.
    }
    // The notes are collected either way — the band is measured off them, so
    // it can be shown with the colouring turned off.
    const colour = props.settings?.highlightNotes ?? true;
    for (const graphicalNote of graphicalNotes) {
        const noteElement: SVGGElement | undefined = graphicalNote.getSVGGElement?.();
        if (noteElement) {
            activeNotes.push(noteElement);
            if (colour) {
                noteElement.classList.add(ACTIVE_CLASS);
                activeElements.push(noteElement);
            }
        }
        if (!colour) continue;
        for (const lyric of graphicalNote.getLyricsSVGs?.() ?? []) {
            lyric.classList.add(ACTIVE_CLASS);
            activeElements.push(lyric);
        }
    }
    updatePlayhead();
}

function updatePlayhead() {
    const layer = layerRef.value;
    if (!layer || !activeNotes.length || !(props.settings?.showPlayhead ?? true)) {
        playhead.value = null;
        return;
    }
    // A system is one staffline per staff, so a grand staff contributes two:
    // the band spans all of them, the way one beat runs down the whole system.
    const systems = new Set<Element>();
    for (const note of activeNotes) {
        const system = note.closest('g.staffline');
        if (system) systems.add(system);
    }
    const firstSystem = systems.values().next().value;
    if (!firstSystem) {
        playhead.value = null;
        return;
    }

    const layerRect = layer.getBoundingClientRect();
    let systemTop = Infinity;
    let systemBottom = -Infinity;
    let systemRight = -Infinity;
    for (const system of systems) {
        const rect = system.getBoundingClientRect();
        systemTop = Math.min(systemTop, rect.top);
        systemBottom = Math.max(systemBottom, rect.bottom);
        systemRight = Math.max(systemRight, rect.right);
    }
    let noteLeft = Infinity;
    let noteRight = -Infinity;
    for (const note of activeNotes) {
        const rect = note.getBoundingClientRect();
        noteLeft = Math.min(noteLeft, rect.left);
        noteRight = Math.max(noteRight, rect.right);
    }

    // The band holds for as long as the note sounds, so it runs up to where
    // the next one starts — or to the end of the system, when there is none.
    const gap = (systemBottom - systemTop) * PLAYHEAD_GAP_RATIO;
    const successorRect = noteAfter(activeNotes[0], firstSystem)?.getBoundingClientRect();
    const runsTo = successorRect ? successorRect.left : systemRight + gap;

    const start = noteLeft - gap;
    const end = Math.max(runsTo - gap, noteRight + gap);
    const sameSystem = firstSystem === activeSystem;
    activeSystem = firstSystem;
    playhead.value = {
        left: start - layerRect.left,
        top: systemTop - layerRect.top,
        width: Math.max(0, end - start),
        height: systemBottom - systemTop,
        // The line travels note centre to note centre, so it stands on the
        // notehead at the moment that note is struck rather than beside it.
        from: (noteLeft + noteRight) / 2 - layerRect.left,
        to:
            (successorRect ? (successorRect.left + successorRect.right) / 2 : systemRight + gap) -
            layerRect.left,
        animate: sameSystem,
    };
    if (!sameSystem) followPlayhead();
    // The element is created by the box above, so it only exists a tick later.
    nextTick(sweepPlayheadLine);
}

// Where the music stands *between* two notes.
//
// The band can only move a note at a time — it marks which note is sounding.
// This line carries the time inside that note: it crosses the notehead as the
// note is struck and reaches the next one exactly as the band moves on, so the
// two never disagree and the motion never breaks. The transform is written
// straight to the element rather than through a binding: it changes every
// frame, and nothing else about the page does.
function sweepPlayheadLine(position = currentPosition()) {
    const line = playheadLineRef.value;
    const box = playhead.value;
    if (!line || !box) return;
    const from = stepPositions[currentStep] ?? 0;
    const to = stepPositions[currentStep + 1] ?? sheetLength;
    const span = to - from;
    const played = span > 0 ? Math.min(1, Math.max(0, (position - from) / span)) : 0;
    line.style.transform = `translateX(${box.from + played * (box.to - box.from)}px)`;
}

// The note the engraving draws after this one. Looked up within the staffline
// rather than across the sheet: a second staff is written out as its own
// staffline after the first, so document order is only musical order inside one.
function noteAfter(note: SVGGElement, system: Element): Element | null {
    const notes = Array.from(system.querySelectorAll('g.vf-stavenote'));
    const index = notes.indexOf(note);
    return index < 0 ? null : (notes[index + 1] ?? null);
}

// Keep the system being played in view — but only when the band reaches a new
// one, so following never fights a reader scrolling the page themselves.
function followPlayhead() {
    if (!clockRunning) return;
    nextTick(() => {
        playheadRef.value?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
    });
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
        instrumentPlayer = null;
    }

    try {
        const { default: PlaybackEngine } = await import('osmd-audio-player');
        const { PlaybackEvent, PlaybackState } =
            await import('osmd-audio-player/dist/PlaybackEngine');
        playbackStates = PlaybackState;
        const { AudioContext } = await import('standardized-audio-context');
        const { LocalSoundfontPlayer } = await import('@/services/localSoundfontPlayer');
        // Local instrument player: soundfonts come precached from the app's
        // own origin (public/soundfonts/) — no gleitz.github.io request.
        const player = new LocalSoundfontPlayer();
        player.setMuted(!!props.muted);
        const engine = new PlaybackEngine(new AudioContext(), player);
        await engine.loadScore(osmd as any);
        if (props.tempo) {
            engine.setBpm(props.tempo);
        }
        // Every note the engine sounds is announced here — which is what moves
        // the mark on the page and pegs the clock to the real position.
        engine.on(PlaybackEvent.ITERATION, () => {
            const position = osmd?.cursor?.Iterator?.CurrentSourceTimestamp?.RealValue;
            if (typeof position === 'number') {
                syncPosition(position);
                currentStep = stepForPosition(position);
            }
            showCursorPosition();
        });
        playbackEngine = engine;
        instrumentPlayer = player;
    } catch (error) {
        console.error('Failed to init OSMD audio player:', error);
        // Audio failure should not block visual rendering
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
    // Every element the mark hung on has just been replaced. Hang it back on
    // where the cursor stands, so a re-engraving mid-song goes unnoticed.
    activeElements = [];
    activeNotes = [];
    activeSystem = null;
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
        startClock();
        showCursorPosition();
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
);

watch(
    () => `${props.settings?.highlightNotes}|${props.settings?.showPlayhead}`,
    () => refreshMark(),
);

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

let layerObserver: ResizeObserver | null = null;

onMounted(() => {
    initOsmd();
    if (layerRef.value) {
        layerObserver = new ResizeObserver(() => updatePlayhead());
        layerObserver.observe(layerRef.value);
    }
});

onBeforeUnmount(async () => {
    stopClock();
    if (layerObserver) {
        layerObserver.disconnect();
        layerObserver = null;
    }
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
        instrumentPlayer = null;
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

/* The beat being sounded, and the line running through it. Both sit behind the
   engraving — the layer is the stacking context, so they reach no further back
   than that — which keeps the notes the darkest thing on the staff. */
.playhead,
.playhead-line {
    position: absolute;
    z-index: -1;
    pointer-events: none;
}

.playhead {
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    transition-property: left, top, width, height;
    transition-duration: 110ms;
    transition-timing-function: ease-out;
}

/* Moved every frame, so it is written straight to the element's transform (see
   sweepPlayheadLine) — never through a CSS transition, which would drag it
   behind the music it is meant to be showing. Faded at both ends so it reads as
   a sweep over the staff rather than a rule drawn across it. */
.playhead-line {
    left: 0;
    width: 2px;
    border-radius: 1px;
    background: linear-gradient(
        to bottom,
        transparent,
        color-mix(in srgb, var(--gold) 70%, transparent) 12%,
        color-mix(in srgb, var(--gold) 70%, transparent) 88%,
        transparent
    );
    will-change: transform;
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
