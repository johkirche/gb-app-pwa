<template>
    <div
        ref="containerRef"
        class="index-scroll"
        :style="{ maxHeight: maxHeight + 'px' }"
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
                :class="{ active: item.key === activeDisplayKey }"
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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

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
    headerOffset?: number; // Offset from top (for header)
}>();

const emit = defineEmits<{
    (e: 'select', key: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const itemsContainerRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const currentDragItem = ref<IndexItem | null>(null);
const indicatorTop = ref(0);

// Space reserved above (header/toolbar) and below (FAB area) the strip.
const TOP_RESERVE_FALLBACK = 120;
const BOTTOM_RESERVE = 80;
const CONTAINER_PADDING = 16; // 8px top + 8px bottom on .index-scroll
const FALLBACK_ITEM_HEIGHT = 24;

const maxHeight = ref(computeMaxHeight());
const itemHeight = ref(FALLBACK_ITEM_HEIGHT);

function computeMaxHeight() {
    const headerOffset = props.headerOffset ?? TOP_RESERVE_FALLBACK;
    return Math.max(0, window.innerHeight - headerOffset - BOTTOM_RESERVE);
}

// How many labels fit in the available height without overflowing.
const maxVisibleItems = computed(() => {
    const usable = maxHeight.value - CONTAINER_PADDING;
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

// Highlight the displayed label closest to the active section.
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

function updateMeasurements() {
    maxHeight.value = computeMaxHeight();
    measureItemHeight();
}

onMounted(() => {
    nextTick(updateMeasurements);
    window.addEventListener('resize', updateMeasurements);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateMeasurements);
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
    position: fixed;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 1000;
    padding: 8px 4px;
    background: rgba(var(--ion-background-color-rgb), 0.9);
    border-radius: 12px;
    backdrop-filter: blur(8px);
    user-select: none;
    touch-action: none;
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
    min-width: 24px;
    min-height: 20px;
    padding: 3px 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    border-radius: 4px;
    flex-shrink: 0;
}

.index-item:hover {
    background: rgba(var(--ion-color-primary-rgb), 0.1);
}

.index-item.active {
    background: var(--ion-color-primary);
    color: var(--ion-color-primary-contrast);
}

.index-label {
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 32px;
}

.drag-indicator {
    position: absolute;
    right: 48px;
    background: var(--ion-color-primary);
    color: var(--ion-color-primary-contrast);
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
