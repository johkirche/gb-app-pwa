<template>
    <div class="song-toolbar">
        <!-- Back button -->
        <ion-button fill="clear" class="back-button" @click="$emit('back')">
            <ion-icon slot="icon-only" :icon="arrowBackOutline" />
        </ion-button>

        <!-- Title or Search Input -->
        <Transition name="title-fade" mode="out-in">
            <div v-if="!isSearchExpanded" key="title" class="toolbar-title">
                <h1>{{ title }}</h1>
            </div>
            <div v-else key="search" class="search-container">
                <ion-icon :icon="searchOutline" class="search-icon" />
                <input
                    ref="searchInputRef"
                    v-model="localSearchQuery"
                    type="text"
                    class="search-input"
                    placeholder="Suchen..."
                    @input="onSearchInput"
                    @keyup.escape="collapseSearch"
                />
                <ion-button
                    v-if="localSearchQuery"
                    fill="clear"
                    size="small"
                    class="clear-search-btn"
                    @click="clearSearch"
                >
                    <ion-icon slot="icon-only" :icon="closeCircleOutline" />
                </ion-button>
            </div>
        </Transition>

        <!-- Action buttons -->
        <div class="toolbar-actions">
            <!-- Filter button with badge (hidden when search is expanded) -->
            <Transition name="action-fade">
                <ion-button
                    v-if="!isSearchExpanded"
                    fill="clear"
                    class="action-btn"
                    :color="hasActiveFilters ? 'primary' : undefined"
                    @click="$emit('openFilters')"
                >
                    <ion-icon slot="icon-only" :icon="filterOutline" />
                    <ion-badge v-if="activeFilterCount > 0" class="filter-badge">
                        {{ activeFilterCount }}
                    </ion-badge>
                </ion-button>
            </Transition>

            <!-- Sort button with current mode indicator (hidden when search is expanded) -->
            <Transition name="action-fade">
                <ion-button
                    v-if="!isSearchExpanded"
                    fill="clear"
                    class="action-btn sort-btn"
                    @click="$emit('openSort')"
                >
                    <div class="sort-icon-wrapper">
                        <ion-icon :icon="swapVerticalOutline" class="sort-main-icon" />
                        <ion-icon :icon="currentSortIcon" class="sort-badge-icon" />
                    </div>
                </ion-button>
            </Transition>

            <!-- Search toggle (always visible, on the right) -->
            <ion-button
                fill="clear"
                class="action-btn"
                :color="isSearchExpanded ? 'primary' : undefined"
                @click="toggleSearch"
            >
                <ion-icon
                    slot="icon-only"
                    :icon="isSearchExpanded ? closeOutline : searchOutline"
                />
            </ion-button>
        </div>
    </div>

    <!-- Active filters chips -->
    <Transition name="chips-slide">
        <div v-if="showFilterChips" class="filter-chips">
            <ion-chip v-if="searchQuery" color="primary" @click="$emit('clearSearch')">
                <ion-icon :icon="searchOutline" />
                <ion-label>"{{ truncate(searchQuery, 15) }}"</ion-label>
                <ion-icon :icon="closeCircle" />
            </ion-chip>

            <ion-chip
                v-for="category in selectedCategories"
                :key="category"
                color="secondary"
                @click="$emit('toggleCategory', category)"
            >
                <ion-icon :icon="pricetagOutline" />
                <ion-label>{{ truncate(category, 12) }}</ion-label>
                <ion-icon :icon="closeCircle" />
            </ion-chip>

            <ion-chip v-if="hasNotes !== null" color="tertiary" @click="$emit('setHasNotes', null)">
                <ion-icon :icon="documentOutline" />
                <ion-label>{{ hasNotes ? 'Mit Noten' : 'Ohne Noten' }}</ion-label>
                <ion-icon :icon="closeCircle" />
            </ion-chip>

            <ion-chip
                v-if="hasMelodyXml !== null"
                color="tertiary"
                @click="$emit('setHasMelodyXml', null)"
            >
                <ion-icon :icon="musicalNoteOutline" />
                <ion-label>{{ hasMelodyXml ? 'Mit MusicXML' : 'Ohne MusicXML' }}</ion-label>
                <ion-icon :icon="closeCircle" />
            </ion-chip>

            <ion-chip
                v-if="filterIndexRange"
                color="tertiary"
                @click="$emit('setIndexRange', null)"
            >
                <ion-icon :icon="listOutline" />
                <ion-label>{{ filterIndexRange.min }}-{{ filterIndexRange.max }}</ion-label>
                <ion-icon :icon="closeCircle" />
            </ion-chip>
        </div>
    </Transition>

    <!-- Results count -->
    <Transition name="results-fade">
        <div v-if="showResultsCount" class="results-count">
            <span>{{ resultCount }} {{ resultCount === 1 ? 'Lied' : 'Lieder' }} gefunden</span>
        </div>
    </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { IonBadge, IonButton, IonChip, IonIcon, IonLabel } from '@ionic/vue';
import {
    arrowBackOutline,
    closeCircle,
    closeCircleOutline,
    closeOutline,
    documentOutline,
    filterOutline,
    listOutline,
    musicalNoteOutline,
    pricetagOutline,
    searchOutline,
    swapVerticalOutline,
    textOutline,
} from 'ionicons/icons';

import type { SortMode } from '@/composables/useSongSorting';

const props = defineProps<{
    title: string;
    searchQuery: string;
    selectedCategories: string[];
    hasNotes: boolean | null;
    hasMelodyXml: boolean | null;
    filterIndexRange: { min: number; max: number } | null;
    activeFilterCount: number;
    hasActiveFilters: boolean;
    sortMode: SortMode;
    resultCount: number;
    totalCount: number;
}>();

const emit = defineEmits<{
    (e: 'back'): void;
    (e: 'search', query: string): void;
    (e: 'clearSearch'): void;
    (e: 'openFilters'): void;
    (e: 'openSort'): void;
    (e: 'toggleCategory', category: string): void;
    (e: 'setHasNotes', value: boolean | null): void;
    (e: 'setHasMelodyXml', value: boolean | null): void;
    (e: 'setIndexRange', range: { min: number; max: number } | null): void;
}>();

// Sort mode icons mapping
const sortModeIcons: Record<SortMode, string> = {
    index: listOutline,
    alphabetical: textOutline,
    category: pricetagOutline,
};

const currentSortIcon = computed(() => sortModeIcons[props.sortMode]);

// Local search state
const isSearchExpanded = ref(false);
const localSearchQuery = ref(props.searchQuery);
const searchInputRef = ref<HTMLInputElement | null>(null);

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Sync with parent
watch(
    () => props.searchQuery,
    (newVal) => {
        localSearchQuery.value = newVal;
    },
);

// Show filter chips when there are active filters or search
const showFilterChips = computed(() => {
    return (
        props.searchQuery ||
        props.selectedCategories.length > 0 ||
        props.hasNotes !== null ||
        props.hasMelodyXml !== null ||
        props.filterIndexRange !== null
    );
});

// Show results count when filtering/searching
const showResultsCount = computed(() => {
    return (props.searchQuery || props.hasActiveFilters) && props.resultCount !== props.totalCount;
});

function toggleSearch() {
    if (isSearchExpanded.value) {
        collapseSearch();
    } else {
        expandSearch();
    }
}

async function expandSearch() {
    isSearchExpanded.value = true;
    await nextTick();
    searchInputRef.value?.focus();
}

function collapseSearch() {
    isSearchExpanded.value = false;
}

function clearSearch() {
    localSearchQuery.value = '';
    emit('search', '');
    emit('clearSearch');
}

function onSearchInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        emit('search', localSearchQuery.value);
    }, 300);
}

function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}
</script>

<style scoped>
.song-toolbar {
    display: flex;
    align-items: center;
    padding: 8px 4px;
    gap: 4px;
    background: var(--ion-background-color);
    position: sticky;
    top: 0;
    z-index: 200;
}

.back-button {
    flex-shrink: 0;
}

.toolbar-title {
    flex: 1;
    min-width: 0;
}

.toolbar-title h1 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.search-container {
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--ion-color-light);
    border-radius: 8px;
    padding: 4px 12px;
    gap: 8px;
}

.search-icon {
    color: var(--ion-color-medium);
    font-size: 18px;
    flex-shrink: 0;
}

.search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 16px;
    padding: 8px 0;
    outline: none;
    color: var(--ion-text-color);
    min-width: 0;
}

.search-input::placeholder {
    color: var(--ion-color-medium);
}

.clear-search-btn {
    --padding-start: 4px;
    --padding-end: 4px;
    margin: 0;
}

.clear-search-btn ion-icon {
    font-size: 18px;
    color: var(--ion-color-medium);
}

.toolbar-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.action-btn {
    --padding-start: 8px;
    --padding-end: 8px;
    position: relative;
}

.filter-badge {
    position: absolute;
    top: 11px;
    right: -7px;
    font-size: 10px;
    padding: 1px 3px;
    min-width: 14px;
    height: 13px;
    --background: var(--ion-color-danger);
    --color: var(--ion-color-danger-contrast);
}

/* Sort button with composite icon */
.sort-btn {
    --padding-start: 10px;
    --padding-end: 10px;
}

.sort-icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
}

.sort-main-icon {
    font-size: 22px;
}

.sort-badge-icon {
    position: absolute;
    bottom: -2px;
    right: -4px;
    font-size: 10px;
    background: var(--ion-color-primary);
    color: var(--ion-color-primary-contrast);
    border-radius: 50%;
    padding: 2px;
}

/* Filter chips */
.filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 12px 8px;
    background: var(--ion-background-color);
}

.filter-chips ion-chip {
    margin: 0;
    height: 28px;
    font-size: 12px;
}

.filter-chips ion-chip ion-icon:first-child {
    margin-right: 4px;
}

.filter-chips ion-chip ion-icon:last-child {
    margin-left: 4px;
    font-size: 14px;
}

/* Results count */
.results-count {
    padding: 4px 16px 8px;
    font-size: 13px;
    color: var(--ion-color-medium);
    background: var(--ion-background-color);
}

/* Animations */
.title-fade-enter-active,
.title-fade-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}

.title-fade-enter-from {
    opacity: 0;
    transform: translateX(10px);
}

.title-fade-leave-to {
    opacity: 0;
    transform: translateX(-10px);
}

.chips-slide-enter-active,
.chips-slide-leave-active {
    transition: all 0.2s ease;
}

.chips-slide-enter-from,
.chips-slide-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

.results-fade-enter-active,
.results-fade-leave-active {
    transition: opacity 0.2s ease;
}

.results-fade-enter-from,
.results-fade-leave-to {
    opacity: 0;
}

/* Action button fade animation */
.action-fade-enter-active,
.action-fade-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}

.action-fade-enter-from,
.action-fade-leave-to {
    opacity: 0;
    transform: scale(0.8);
}
</style>
