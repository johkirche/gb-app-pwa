<template>
    <ion-page>
        <ion-content
            ref="contentRef"
            :fullscreen="true"
            :scroll-events="true"
            @ionScroll="onScroll"
        >
            <!-- Toolbar with Search, Filter, Sort -->
            <SongToolbar
                title="Gesangbuch"
                :search-query="filters.searchQuery"
                :selected-categories="filters.selectedCategories"
                :has-notes="filters.hasNotes"
                :has-melody-xml="filters.hasMelodyXml"
                :filter-index-range="filters.indexRange"
                :active-filter-count="activeFilterCount"
                :has-active-filters="hasActiveFilters"
                :sort-mode="sortMode"
                :result-count="filteredSongs.length"
                :total-count="songs.length"
                @back="$router.back()"
                @search="setSearchQuery"
                @clear-search="clearSearch"
                @open-filters="openFilters"
                @open-sort="showSortOptions = true"
                @toggle-category="toggleCategory"
                @set-has-notes="setHasNotes"
                @set-has-melody-xml="setHasMelodyXml"
                @set-index-range="setIndexRange"
            />

            <!-- Sort Options Action Sheet -->
            <ion-action-sheet
                mode="ios"
                :is-open="showSortOptions"
                header="Sortierung"
                :buttons="sortActionButtons"
                @didDismiss="showSortOptions = false"
            />

            <!-- Filter Bottom Drawer -->
            <SongFilterDrawer
                :is-open="showFilterDrawer"
                :available-categories="availableCategories"
                :selected-categories="filters.selectedCategories"
                :has-notes="filters.hasNotes"
                :has-melody-xml="filters.hasMelodyXml"
                :filter-index-range="filters.indexRange"
                :index-range="indexRange"
                :has-active-filters="hasActiveFilters"
                @close="showFilterDrawer = false"
                @toggle-category="toggleCategory"
                @set-has-notes="setHasNotes"
                @set-has-melody-xml="setHasMelodyXml"
                @set-index-range="setIndexRange"
                @clear-all="clearFiltersKeepSearch"
            />

            <!-- Loading State -->
            <div v-if="isLoading" class="state-container">
                <ion-spinner name="crescent"></ion-spinner>
                <p>Lieder werden synchronisiert...</p>
            </div>

            <!-- Error State -->
            <ion-card v-else-if="error" color="danger" class="ion-margin">
                <ion-card-content>
                    <p>{{ error }}</p>
                </ion-card-content>
            </ion-card>

            <!-- Empty State (no songs at all) -->
            <div v-else-if="!hasSongs" class="state-container empty-state">
                <ion-icon :icon="musicalNotesOutline" size="large"></ion-icon>
                <h2>Keine Lieder vorhanden</h2>
                <p>Tippen Sie auf das Sync-Symbol, um Lieder zu laden.</p>
            </div>

            <!-- No Results State (filtered to nothing) -->
            <div v-else-if="sortedSections.length === 0" class="state-container empty-state">
                <ion-icon :icon="searchOutline" size="large"></ion-icon>
                <h2>Keine Ergebnisse</h2>
                <p>Keine Lieder entsprechen den Filterkriterien.</p>
                <ion-button fill="outline" @click="clearAllFilters">Filter zurücksetzen</ion-button>
            </div>

            <!-- Songs List with Sections -->
            <ion-list v-else class="songs-list">
                <template v-for="section in sortedSections" :key="section.key">
                    <!-- Section Header (only shown when showHeaders is true) -->
                    <SongSectionHeader
                        v-if="showHeaders"
                        :section-key="section.key"
                        :label="section.label"
                    />

                    <!-- Songs in this section -->
                    <button
                        v-for="song in section.songs"
                        :key="song.id"
                        type="button"
                        class="song-row"
                        :class="{ 'song-row--with-index-scroll': isIndexScrollerVisible }"
                        :data-section="section.key"
                        @click="navigateToSong(song.id)"
                        @contextmenu.prevent="openSongActions(song.id)"
                        v-long-press="() => openSongActions(song.id)"
                    >
                        <span
                            class="song-row__number"
                            :class="{ 'song-row__number--empty': !song.index }"
                        >
                            <template v-if="song.index">{{ song.index }}</template>
                            <span v-else class="song-row__number-dot" aria-hidden="true"></span>
                        </span>
                        <span class="song-row__text">
                            <span class="song-row__title">{{ song.titel }}</span>
                            <span
                                v-if="sortMode !== 'category' && formatCategories(song.kategorien)"
                                class="song-row__category"
                            >
                                {{ formatCategories(song.kategorien) }}
                            </span>
                        </span>
                        <ion-icon
                            class="song-row__chevron"
                            :icon="chevronForwardOutline"
                            aria-hidden="true"
                        ></ion-icon>
                    </button>
                </template>
            </ion-list>

            <!-- Last Sync Info -->
            <div v-if="lastSyncTime" class="sync-info">
                <p>Zuletzt synchronisiert: {{ formatSyncTime(lastSyncTime) }}</p>
            </div>
        </ion-content>

        <!-- Index Scroll Sidebar -->
        <IndexScroll
            v-if="isIndexScrollerVisible"
            :items="indexItems"
            :active-key="activeSection"
            @select="scrollToSection"
        />

        <!-- Song Action Sheet (long-press menu) -->
        <ion-action-sheet
            mode="ios"
            css-class="action-sheet-aligned"
            :is-open="showSongActions"
            header="Aktionen"
            :buttons="songActionButtons"
            @didDismiss="closeSongActions"
        />

        <!-- Playlist Select Modal -->
        <PlaylistSelectModal
            :is-open="showPlaylistModal"
            :song-id="selectedSongId"
            @close="showPlaylistModal = false"
            @added="onSongAddedToPlaylist"
        />
    </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
    IonActionSheet,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonList,
    IonPage,
    IonSpinner,
    type ScrollDetail,
} from '@ionic/vue';
import {
    checkmarkOutline,
    chevronForwardOutline,
    heart,
    heartOutline,
    listOutline,
    musicalNotesOutline,
    searchOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { useFavoritesStore } from '@/stores/favorites';
import { useSongsStore } from '@/stores/songs';

import { useSongFiltering } from '@/composables/useSongFiltering';
import { SORT_OPTIONS, useSongSorting } from '@/composables/useSongSorting';

import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue';
import IndexScroll from '@/components/songlist/IndexScroll.vue';
import SongFilterDrawer from '@/components/songlist/SongFilterDrawer.vue';
import SongSectionHeader from '@/components/songlist/SongSectionHeader.vue';
import SongToolbar from '@/components/songlist/SongToolbar.vue';

import type { Category } from '@/db';

const songsStore = useSongsStore();
const favoritesStore = useFavoritesStore();
const { songs, isLoading, error, lastSyncTime, hasSongs } = storeToRefs(songsStore);
const router = useRouter();

// Content ref for scroll operations
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

// Filtering - applied first
const {
    filters,
    filteredSongs,
    isSearchActive,
    hasActiveFilters,
    activeFilterCount,
    availableCategories,
    indexRange,
    setSearchQuery,
    clearSearch,
    toggleCategory,
    setHasNotes,
    setHasMelodyXml,
    setIndexRange,
    clearAllFilters,
    clearFiltersKeepSearch,
} = useSongFiltering(songs);

// Sorting - applied to filtered songs
const { sortMode, showHeaders, showIndexScroll, sortedSections, indexItems } =
    useSongSorting(filteredSongs);

// UI State
const showSortOptions = ref(false);
const showFilterDrawer = ref(false);
const activeSection = ref<string>('');

// Long-press / Song Actions State
const showSongActions = ref(false);
const showPlaylistModal = ref(false);
const selectedSongId = ref<string>('');

// Open filter drawer
function openFilters() {
    showFilterDrawer.value = true;
}

const isIndexScrollerVisible = computed(() => {
    return (
        showIndexScroll.value &&
        indexItems.value.length > 1 &&
        !isSearchActive.value &&
        !hasActiveFilters.value
    );
});

// Action sheet buttons for sort options
const sortActionButtons = computed(() => [
    ...SORT_OPTIONS.map((option) => ({
        text: option.label,
        icon: sortMode.value === option.value ? checkmarkOutline : undefined,
        handler: () => {
            sortMode.value = option.value;
            // Reset active section when changing sort mode
            if (sortedSections.value.length > 0) {
                activeSection.value = sortedSections.value[0].key;
            }
        },
    })),
    {
        text: 'Abbrechen',
        role: 'cancel' as const,
    },
]);

// Song action sheet buttons
const songActionButtons = computed(() => {
    const isFav = selectedSongId.value ? favoritesStore.isFavorite(selectedSongId.value) : false;
    return [
        {
            text: isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen',
            icon: isFav ? heart : heartOutline,
            handler: () => {
                if (selectedSongId.value) {
                    favoritesStore.toggleFavorite(selectedSongId.value);
                }
            },
        },
        {
            text: 'Zu Playlist hinzufügen',
            icon: listOutline,
            handler: () => {
                showPlaylistModal.value = true;
            },
        },
        {
            text: 'Abbrechen',
            role: 'cancel' as const,
        },
    ];
});

// Long-press handler
function openSongActions(songId: string) {
    selectedSongId.value = songId;
    showSongActions.value = true;
}

function closeSongActions() {
    showSongActions.value = false;
}

function onSongAddedToPlaylist(_playlistId: string) {
    // Could show a toast notification here
}

// Viewport Y just below the sticky header(s), where a scrolled-to item should
// land. Measured from the toolbar's live rendered bottom edge so it already
// accounts for safe-area insets (viewport-fit=cover), font scaling and device
// differences — anything that hardcoded heights would miss.
function getHeaderBottom(scrollEl: HTMLElement): number {
    const GAP = 8; // small breathing room below the header

    const toolbar = document.querySelector('.song-toolbar') as HTMLElement | null;
    let headerBottom = toolbar
        ? toolbar.getBoundingClientRect().bottom
        : scrollEl.getBoundingClientRect().top + 56;

    // In modes with headers the section divider is also sticky and stacks below
    // the toolbar, so the item must clear it too.
    if (showHeaders.value) {
        const divider = document.querySelector('.section-header') as HTMLElement | null;
        if (divider) headerBottom += divider.getBoundingClientRect().height;
    }

    return headerBottom + GAP;
}

// Scroll to a specific section - always scroll to first item in section
async function scrollToSection(sectionKey: string) {
    if (!contentRef.value) {
        return;
    }

    // Always find the first item in the section (works for all sort modes)
    const firstItem = document.querySelector(
        `[data-section="${sectionKey}"]`,
    ) as HTMLElement | null;
    if (!firstItem) {
        return;
    }

    // Work in viewport coordinates and scroll by a relative delta: move the item
    // from where it currently is to just below the sticky header. This is immune
    // to offsetParent quirks and safe-area padding inside the scroll container.
    const scrollEl: HTMLElement = await contentRef.value.$el.getScrollElement();
    const delta = firstItem.getBoundingClientRect().top - getHeaderBottom(scrollEl);
    const target = scrollEl.scrollTop + delta;

    await contentRef.value.$el.scrollToPoint(0, Math.max(0, target), 300);
}

// Handle scroll events to update active section
function onScroll(event: CustomEvent<ScrollDetail>) {
    const scrollTop = event.detail.scrollTop;
    const viewportMiddle = scrollTop + 150; // Offset for better UX

    // Find the section that's currently in view
    for (let i = sortedSections.value.length - 1; i >= 0; i--) {
        const section = sortedSections.value[i];
        const element = showHeaders.value
            ? document.getElementById(`section-${section.key}`)
            : document.querySelector(`[data-section="${section.key}"]`);

        if (element && (element as HTMLElement).offsetTop <= viewportMiddle) {
            if (activeSection.value !== section.key) {
                activeSection.value = section.key;
            }
            break;
        }
    }
}

// Navigate to song detail page
function navigateToSong(songId: string) {
    router.push(`/songs/${songId}`);
}

// Format categories for display
function formatCategories(categories: Category[]): string {
    return categories
        .map((c) => c.name?.trim())
        .filter((name): name is string => !!name)
        .join(', ');
}

// Format sync time for display
function formatSyncTime(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}
</script>

<style scoped>
.songs-list {
    padding-top: 0;
    background: transparent;
}

/* Song row — mirrors the home screen's .home-nav__item button rows */
.song-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ion-color-light-shade);
    padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xs);
    cursor: pointer;
    text-align: left;
    color: inherit;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease;
}

.song-row:last-child {
    border-bottom: none;
}

.song-row:active {
    background: var(--ion-color-light);
}

/* Desktop hover — only on devices with a precise pointer, so tapping on a
   touchscreen doesn't leave a sticky hover state behind */
@media (hover: hover) and (pointer: fine) {
    .song-row:hover {
        background: var(--ion-color-light);
    }

    .song-row:hover .song-row__number {
        border-color: var(--ion-color-primary);
    }

    .song-row:hover .song-row__chevron {
        color: var(--ion-color-primary);
        transform: translateX(3px);
    }
}

.song-row:focus-visible {
    outline: 2px solid var(--ion-color-primary);
    outline-offset: -2px;
    border-radius: var(--radius-md);
}

/* Reserve room on the right so text/chevron never sit under the index strip (~40px) */
.song-row--with-index-scroll {
    padding-inline-end: 40px;
}

/* Number box — mirrors .home-nav__icon (fixed width fits up to 3 digits) */
.song-row__number {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.5rem;
    border: 1px solid var(--ion-color-light-shade);
    border-radius: var(--radius-md);
    font-size: var(--font-size-lg);
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--ion-color-primary);
    transition: border-color 0.15s ease;
}

/* Graceful "no number" state */
.song-row__number--empty {
    color: var(--ion-color-medium);
}

.song-row__number-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ion-color-medium);
    transform: rotate(45deg);
}

.song-row__text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.song-row__title {
    font-size: var(--font-size-base);
    font-weight: 500;
    line-height: 1.3;
    overflow-wrap: break-word;
    word-break: break-word;
}

.song-row__category {
    font-size: var(--font-size-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ion-color-medium);
}

.song-row__chevron {
    flex: 0 0 auto;
    color: var(--ion-color-medium);
    font-size: var(--font-size-base);
    transition:
        color 0.15s ease,
        transform 0.15s ease;
}

.sync-info {
    padding: 16px;
    text-align: center;
    color: var(--ion-color-medium);
    font-size: 0.85rem;
}

.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
}

.state-container ion-icon {
    font-size: 64px;
    color: var(--ion-color-medium);
    margin-bottom: 16px;
}

.state-container h2 {
    margin: 0 0 8px;
    color: var(--ion-color-dark);
}

.state-container p {
    margin: 0 0 16px;
    color: var(--ion-color-medium);
}

.empty-state ion-button {
    margin-top: 8px;
}
</style>
