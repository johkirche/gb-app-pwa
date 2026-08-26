<template>
    <div
        ref="containerRef"
        class="index-scroll"
        :class="{ dragging: isDragging }"
        :style="{ top: bandTop + 'px', height: bandHeight + 'px' }"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
        @mousedown.prevent="onMouseDown"
    >
        <div ref="itemsContainerRef" class="index-items">
            <div
                v-for="item in displayItems"
                :key="item.originalIndex"
                class="index-item"
                :class="{
                    current: item.key === activeDisplayKey,
                    pressed: item.key === pressedDisplayKey,
                }"
                :data-key="item.key"
                @click="onItemClick(item.key)"
            >
                <span class="index-label">{{ item.label }}</span>
            </div>
        </div>

        <!-- Floating indicator shown during drag -->
        <Transition name="indicator-fade">
            <div
                v-if="isDragging && currentDragItem"
                class="drag-indicator"
                :style="{ top: indicatorTop + 'px' }"
            >
                {{ currentDragItem.label }}
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

export interface IndexItem {
    key: string;
    label: string;
}

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

// Breathing room kept above and below the rail inside its band.
const BAND_INSET = 8;
const CONTAINER_PADDING = 12; // 6px top + 6px bottom on .index-scroll
const FALLBACK_ITEM_HEIGHT = 21;

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

function onItemClick(key: string) {
    emit('select', key);
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
    min-width: 26px;
    min-height: 21px;
    padding: 3px 5px;
    color: var(--muted-foreground);
    cursor: inherit;
    transition: all 0.15s ease;
    border-radius: 4px;
    flex-shrink: 0;
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
