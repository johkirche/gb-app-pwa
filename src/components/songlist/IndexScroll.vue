<template>
    <div
        ref="containerRef"
        class="index-scroll"
        :class="{ dragging: isDragging }"
        :style="{ top: bandTop + 'px', height: bandHeight + 'px' }"
        role="toolbar"
        aria-orientation="vertical"
        aria-label="Register – zum Abschnitt springen"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
        @mousedown.prevent="onMouseDown"
        @keydown="onKeydown"
    >
        <div ref="itemsContainerRef" class="index-items">
            <button
                v-for="(item, slot) in displayItems"
                :key="item.originalIndex"
                type="button"
                class="index-item"
                :class="{
                    current: item.key === activeDisplayKey,
                    pressed: item.key === pressedDisplayKey,
                }"
                :data-key="item.key"
                :tabindex="slot === focusSlot ? 0 : -1"
                :aria-label="item.ariaLabel ?? item.label"
                :aria-current="item.key === activeDisplayKey ? 'location' : undefined"
                @click="onItemClick(item.key, slot)"
            >
                <span class="index-label">{{ item.label }}</span>
            </button>
        </div>

        <!-- Floating indicator shown during drag -->
        <Transition name="indicator-fade">
            <div
                v-if="isDragging && currentDragItem"
                class="drag-indicator"
                :style="{ top: indicatorTop + 'px' }"
                aria-hidden="true"
            >
                {{ currentDragItem.label }}
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import type { IndexItem } from '@/composables/useSongSorting';

interface DisplayItem extends IndexItem {
    originalIndex: number;
}

const props = defineProps<{
    items: IndexItem[];
    activeKey?: string;
    /** Box the rail centers itself in — pass the scroll area so the strip
        ignores the toolbar above it. Falls back to the offset parent. */
    boundsEl?: HTMLElement | null;
}>();

const emit = defineEmits<{
    (e: 'select', key: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const itemsContainerRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const currentDragItem = ref<IndexItem | null>(null);
// The label under the finger. Kept apart from the active section: that one only
// catches up once the list has scrolled, so a single highlight driven by it
// trails the press.
const pressedDisplayKey = ref<string | null>(null);
const indicatorTop = ref(0);
// Which label carries the rail's single tab stop. See "Keyboard handling".
const focusSlot = ref(0);

// Breathing room kept above and below the rail inside its band.
const BAND_INSET = 8;
const CONTAINER_PADDING = 12; // 6px top + 6px bottom on .index-scroll
// Mirrors `min-height` on .index-item, which is WCAG 2.5.8's 24px target floor
// — the guard in IndexScroll.spec.ts fails if the two drift apart.
const FALLBACK_ITEM_HEIGHT = 24;

// The band the strip lives in, measured from the bounds element rather than the
// viewport: a guessed header height cannot track a toolbar that grows (filter
// chips) or a safe-area inset, and centering on the full page column pulls the
// rail up by half the toolbar.
const bandTop = ref(0);
const bandHeight = ref(window.innerHeight);
const itemHeight = ref(FALLBACK_ITEM_HEIGHT);

// How many labels fit in the band without overflowing.
const maxVisibleItems = computed(() => {
    const usable = bandHeight.value - CONTAINER_PADDING;
    return Math.max(1, Math.floor(usable / itemHeight.value));
});

// Labels actually rendered. When there are more groups than fit, the list is
// evenly down-sampled (first and last always kept) so the strip never overflows
// and every part of it stays reachable while dragging.
const displayItems = computed<DisplayItem[]>(() => {
    const all = props.items;
    const n = maxVisibleItems.value;

    if (all.length <= n) {
        return all.map((item, i) => ({ ...item, originalIndex: i }));
    }

    const result: DisplayItem[] = [];
    let lastIdx = -1;
    for (let k = 0; k < n; k++) {
        const idx = Math.round((k * (all.length - 1)) / (n - 1));
        if (idx !== lastIdx) {
            result.push({ ...all[idx], originalIndex: idx });
            lastIdx = idx;
        }
    }
    return result;
});

// Mark the displayed label closest to the section the list actually sits on.
const activeDisplayKey = computed(() => {
    if (!props.activeKey) return undefined;
    if (displayItems.value.some((d) => d.key === props.activeKey)) {
        return props.activeKey;
    }

    const activeIdx = props.items.findIndex((i) => i.key === props.activeKey);
    if (activeIdx < 0) return undefined;

    let bestKey: string | undefined;
    let bestDist = Infinity;
    for (const d of displayItems.value) {
        const dist = Math.abs(d.originalIndex - activeIdx);
        if (dist < bestDist) {
            bestDist = dist;
            bestKey = d.key;
        }
    }
    return bestKey;
});

function measureItemHeight() {
    const first = itemsContainerRef.value?.querySelector('.index-item') as HTMLElement | null;
    if (first) {
        const h = first.getBoundingClientRect().height;
        if (h > 0) itemHeight.value = h;
    }
}

function resolveBounds() {
    const el = containerRef.value;
    if (!el) return null;
    const parent = (el.offsetParent as HTMLElement | null) ?? el.parentElement;
    if (!parent) return null;
    return { parent, bounds: props.boundsEl ?? parent };
}

function measureBand() {
    const resolved = resolveBounds();
    if (!resolved) return;
    const parentRect = resolved.parent.getBoundingClientRect();
    const boundsRect = resolved.bounds.getBoundingClientRect();
    if (boundsRect.height === 0) return;
    bandTop.value = boundsRect.top - parentRect.top + BAND_INSET;
    bandHeight.value = Math.max(0, boundsRect.height - BAND_INSET * 2);
}

function updateMeasurements() {
    measureBand();
    measureItemHeight();
}

// The band shrinks when the toolbar grows a filter-chip row, so watch its box
// rather than only the window.
let bandObserver: ResizeObserver | null = null;

function observeBand() {
    bandObserver?.disconnect();
    bandObserver = null;
    const resolved = resolveBounds();
    if (!resolved || typeof ResizeObserver === 'undefined') return;
    bandObserver = new ResizeObserver(updateMeasurements);
    bandObserver.observe(resolved.bounds);
}

function remeasureAndObserve() {
    nextTick(() => {
        updateMeasurements();
        observeBand();
    });
}

onMounted(() => {
    remeasureAndObserve();
    window.addEventListener('resize', updateMeasurements);
});

watch(() => props.boundsEl, remeasureAndObserve);

onUnmounted(() => {
    window.removeEventListener('resize', updateMeasurements);
    bandObserver?.disconnect();
});

// --- Pointer handling -----------------------------------------------------

// Mouse event handlers for desktop
function onMouseDown(event: MouseEvent) {
    isDragging.value = true;
    updateFromPosition(event.clientY);

    const onMouseMove = (e: MouseEvent) => {
        if (isDragging.value) {
            updateFromPosition(e.clientY);
        }
    };

    const onMouseUp = () => {
        isDragging.value = false;
        currentDragItem.value = null;
        pressedDisplayKey.value = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Touch event handlers for mobile
function onTouchStart(event: TouchEvent) {
    isDragging.value = true;
    updateFromPosition(event.touches[0].clientY);
}

function onTouchMove(event: TouchEvent) {
    if (!isDragging.value) return;
    updateFromPosition(event.touches[0].clientY);
}

function onTouchEnd() {
    isDragging.value = false;
    currentDragItem.value = null;
    pressedDisplayKey.value = null;
}

// Map a vertical position on the strip to an item in the FULL list, so every
// group stays reachable even when only a subset of labels is rendered.
function updateFromPosition(clientY: number) {
    const all = props.items;
    if (!itemsContainerRef.value || all.length === 0) return;

    const stripRect = itemsContainerRef.value.getBoundingClientRect();
    if (stripRect.height === 0) return;

    const fraction = (clientY - stripRect.top) / stripRect.height;
    const clamped = Math.min(1, Math.max(0, fraction));
    const targetIndex = Math.round(clamped * (all.length - 1));
    const item = all[targetIndex];
    if (!item) return;

    // Which rendered label the pointer is over — the slots tile the strip
    // evenly, so this snaps to the finger instead of waiting for the scroll.
    const slots = displayItems.value.length;
    const slot = Math.min(slots - 1, Math.max(0, Math.floor(clamped * slots)));
    pressedDisplayKey.value = displayItems.value[slot]?.key ?? null;

    // Position the floating indicator next to the finger/cursor.
    const outerRect = containerRef.value?.getBoundingClientRect();
    if (outerRect) {
        const offset = clientY - outerRect.top - 20;
        indicatorTop.value = Math.min(Math.max(offset, 0), outerRect.height - 40);
    }

    if (item.key !== currentDragItem.value?.key) {
        currentDragItem.value = item;
        emit('select', item.key);
    }
}

function onItemClick(key: string, slot: number) {
    focusSlot.value = slot;
    emit('select', key);
}

// --- Keyboard handling ----------------------------------------------------

// The rail is a toolbar with a roving tab stop: one Tab reaches it, then Up and
// Down walk the labels and Enter jumps. Thirty tab stops sitting between the
// toolbar and the list would be worse for a keyboard reader than no rail at
// all, since they would have to pass through every one of them.

// Park the tab stop on the section the list is actually showing, so Tab lands
// where the reader already is rather than back at the top of the alphabet.
// This moves the stop only, never the focus: the rail must not pull focus out
// from under someone who is scrolling the list with a finger.
watch([activeDisplayKey, displayItems], ([key, items]) => {
    const idx = key ? items.findIndex((d) => d.key === key) : -1;
    focusSlot.value = idx >= 0 ? idx : Math.min(focusSlot.value, Math.max(0, items.length - 1));
});

function itemElements(): HTMLElement[] {
    return [...(itemsContainerRef.value?.querySelectorAll<HTMLElement>('.index-item') ?? [])];
}

// Where an arrow key steps from. Read off the focused element rather than
// `focusSlot`, which the watcher above moves as the list scrolls.
function currentSlot(elements: HTMLElement[]): number {
    const focused = elements.indexOf(document.activeElement as HTMLElement);
    return focused >= 0 ? focused : focusSlot.value;
}

function onKeydown(event: KeyboardEvent) {
    const elements = itemElements();
    if (elements.length === 0) return;
    const from = currentSlot(elements);

    let to: number;
    switch (event.key) {
        case 'ArrowDown':
            to = from + 1;
            break;
        case 'ArrowUp':
            to = from - 1;
            break;
        case 'Home':
            to = 0;
            break;
        case 'End':
            to = elements.length - 1;
            break;
        default:
            // Enter and Space belong to the buttons; the rest to the page.
            return;
    }

    event.preventDefault();
    focusSlot.value = Math.min(elements.length - 1, Math.max(0, to));
    elements[focusSlot.value].focus();
}
</script>

<style scoped>
.index-scroll {
    /* absolute (not fixed): anchors to the page column, so on desktop the strip
       hugs the centered content column instead of the viewport edge */
    position: absolute;
    /* the whole strip is one scrub surface (tap to jump, drag to scan) */
    cursor: grab;
    /* Hug the shared page column: the page wrapper is full-width, so offset
       by the column's own margin instead of sticking to the viewport edge. */
    right: calc(max(0px, (100% - var(--page-col-max)) / 2) + 4px);
    /* top/height come from the measured band; the labels center inside it, so
       the rail sits on the scroll area's axis, not the whole page column's. */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* Above page chrome (sticky headers z-10, page header z-20), below overlays
       (dialogs/drawers z-50) — the legacy z-1000 painted over them. */
    z-index: 30;
    padding: 6px 3px;
    /* No container: the rail has its own gutter, so nothing scrolls under it.
       At full height (500+ songs it renders ~30 labels) a bordered panel reads
       as a heavy second column — the labels alone are the right weight. */
    background: transparent;
    border-radius: 10px;
    user-select: none;
    touch-action: none;
}

.index-scroll.dragging {
    cursor: grabbing;
}

.index-items {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
}

.index-item {
    display: flex;
    align-items: center;
    justify-content: center;
    /* px, like the rest of the rail: 26x24 is WCAG 2.5.8's target floor, which
       is stated in device pixels and describes the finger, not the type. */
    min-width: 26px;
    min-height: 24px;
    padding: 3px 5px;
    -webkit-tap-highlight-color: transparent;
    color: var(--muted-foreground);
    transition: all 0.15s ease;
    border-radius: 4px;
    flex-shrink: 0;
}

/* Outspecifies the global `button { cursor: pointer }` in main.css: the whole
   rail is one scrub surface, so the labels take its grab hand. */
.index-scroll .index-item {
    cursor: inherit;
}

/* The rail clips its own column, so the global 2px outset ring would be cut in
   half. Draw it inside the chip instead. */
.index-item:focus-visible {
    outline-offset: -2px;
}

.index-item:hover {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.index-item.current,
.index-item.pressed {
    background: var(--primary);
    color: var(--primary-foreground);
}

/* While scrubbing, the filled chip belongs to the finger. The section the list
   is on keeps a quieter ring, so both places stay readable at once. */
.index-scroll.dragging .index-item.current:not(.pressed) {
    background: color-mix(in srgb, var(--primary) 14%, transparent);
    color: var(--primary);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 45%, transparent);
}

/* The press chip has to land with the finger, not fade after it. */
.index-scroll.dragging .index-item {
    transition: none;
}

/* The one place in the app that stays in px while everything else follows the
   reader's Größe (see main.css). The rail is not read, it is aimed at: ~30
   labels stacked inside the viewport's height, with `overflow: hidden` behind
   them. Enlarging the type would not enlarge the rail — it would drop the last
   letters off the bottom, and the reader who asked for bigger type would lose
   the fastest way into the list. The list it scrolls does grow. */
.index-label {
    font-size: 11.5px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 32px;
}

.drag-indicator {
    position: absolute;
    right: 48px;
    background: var(--primary);
    color: var(--primary-foreground);
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: bold;
    min-width: 60px;
    max-width: 200px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.indicator-fade-enter-active,
.indicator-fade-leave-active {
    transition: opacity 0.15s ease;
}

.indicator-fade-enter-from,
.indicator-fade-leave-to {
    opacity: 0;
}
</style>
