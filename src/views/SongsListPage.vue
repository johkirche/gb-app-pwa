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
            <ion-list
                v-else
                class="songs-list"
                :class="{ 'with-index-scroll': isIndexScrollerVisible }"
            >
                <template v-for="section in sortedSections" :key="section.key">
                    <!-- Section Header (only shown when showHeaders is true) -->
                    <SongSectionHeader
                        v-if="showHeaders"
                        :section-key="section.key"
                        :label="section.label"
                    />

                    <!-- Songs in this section -->
                    <ion-item
                        v-for="song in section.songs"
                        :key="song.id"
                        button
                        detail
                        :data-section="section.key"
                        @click="navigateToSong(song.id)"
                        @contextmenu.prevent="openSongActions(song.id)"
                        v-long-press="() => openSongActions(song.id)"
                    >
                        <ion-label>
                            <h2>
                                <span v-if="song.index" class="song-index">{{ song.index }}.</span>
                                <span class="song-title-text">{{ song.titel }}</span>
                            </h2>
                            <p v-if="sortMode !== 'category' && formatCategories(song.kategorien)">
                                {{ formatCategories(song.kategorien) }}
                            </p>
                            <p v-if="song.textAutoren.length > 0" class="authors">
                                Text: {{ formatAuthors(song.textAutoren) }}
                            </p>
                            <p v-if="song.melodieAutoren.length > 0" class="authors">
                                Melodie: {{ formatAuthors(song.melodieAutoren) }}
                            </p>
                        </ion-label>
                    </ion-item>
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
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonSpinner,
    type ScrollDetail,
} from '@ionic/vue';
import {
    checkmarkOutline,
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

import type { Autor, Category } from '@/db';

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

// Format authors for display
function formatAuthors(authors: Autor[]): string {
    return authors
        .map((a) => {
            const name = `${a.vorname} ${a.nachname}`;
            return a.sterbejahr ? `${name} (†${a.sterbejahr})` : name;
        })
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
.authors {
    font-size: var(--font-size-sm);
    color: var(--ion-color-medium);
}

.songs-list {
    padding-top: 0;
}

.songs-list.with-index-scroll ion-item {
    --inner-padding-end: 40px;
}

.song-index {
    font-weight: 600;
    color: var(--ion-color-primary);
    margin-right: 4px;
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

ion-item h2 {
    display: flex;
    align-items: start;
    gap: 6px;
    flex-wrap: nowrap;
    justify-content: space-between;
}

.song-title-text {
    flex: 1 1 auto;
    overflow-wrap: break-word;
    word-break: break-word;
    min-width: 0;
}
</style>
