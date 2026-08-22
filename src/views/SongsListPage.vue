<template>
    <!-- relative: positioning context for the absolute IndexScroll strip -->
    <div class="relative flex h-full flex-col bg-background">
        <!-- Toolbar with Search, Filter, Sort — outside the scroll container, so
             sticky section headers inside <main> dock at top-0 -->
        <SongToolbar
            title="Lieder"
            :show-back="false"
            :search-query="filters.searchQuery"
            :selected-categories="filters.selectedCategories"
            :selected-authors="filters.selectedAuthors"
            :active-melodien="activeMelodien"
            :filter-index-range="filters.indexRange"
            :active-filter-count="activeFilterCount"
            :has-active-filters="hasActiveFilters"
            :sort-mode="sortMode"
            :result-count="filteredSongs.length"
            :total-count="songs.length"
            @search="setSearchQuery"
            @clear-search="clearSearch"
            @open-filters="toggleFilters"
            @open-sort="toggleSortOptions"
            @toggle-category="toggleCategory"
            @toggle-author="toggleAuthor"
            @toggle-melodie="toggleMelodie"
            @set-index-range="setIndexRange"
        />

        <main
            ref="scrollRef"
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            :class="{ 'scrollbar-none': isIndexScrollerVisible }"
            @scroll="onScroll"
        >
            <!-- The index rail overlays this column, so everything in it —
                 Lied der Woche, states and the list — shares the same gutter. -->
            <div class="page-col pb-8" :class="{ 'pr-12': isIndexScrollerVisible }">
                <!-- Featured: Lied der Woche (hidden while searching/filtering) -->
                <button
                    v-if="songOfTheWeek && !filters.searchQuery && !hasActiveFilters"
                    type="button"
                    class="mb-2 mt-4 w-full rounded-lg border bg-card text-left text-card-foreground shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
                    @click="openSongOfTheWeek"
                >
                    <span class="flex items-center gap-6 p-6">
                        <span class="number-display shrink-0 text-6xl leading-none">
                            {{ songOfTheWeek.index }}
                        </span>
                        <span class="block min-w-0">
                            <span class="label-micro block text-gold">Lied der Woche</span>
                            <span
                                class="mt-1.5 block font-display text-2xl font-semibold leading-tight"
                            >
                                {{ songOfTheWeek.titel }}
                            </span>
                            <span
                                class="mt-1.5 block text-[11px] tracking-[0.14em] text-muted-foreground"
                            >
                                {{ songOfTheWeekMeta }}
                            </span>
                        </span>
                    </span>
                </button>

                <!-- Loading State -->
                <div
                    v-if="isLoading"
                    class="flex flex-col items-center justify-center px-6 py-12 text-center"
                >
                    <Spinner size="lg" />
                    <p class="mt-4 text-muted-foreground">Lieder werden synchronisiert...</p>
                </div>

                <!-- Error State -->
                <div
                    v-else-if="error"
                    class="my-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
                >
                    <p>{{ error }}</p>
                </div>

                <!-- Empty State (no songs at all) -->
                <div
                    v-else-if="!hasSongs"
                    class="flex flex-col items-center justify-center px-6 py-12 text-center"
                >
                    <Music class="h-14 w-14 text-muted-foreground/50" aria-hidden="true" />
                    <h2 class="mt-5 font-display text-2xl font-semibold">Keine Lieder vorhanden</h2>
                    <p class="mt-2 text-muted-foreground">
                        Laden Sie das Gesangbuch einmal herunter, um es offline zu nutzen.
                    </p>
                    <Button class="mt-6" @click="router.push('/download')">
                        <CloudDownload aria-hidden="true" />
                        Lieder herunterladen
                    </Button>
                </div>

                <!-- No Results State (filtered to nothing) -->
                <div
                    v-else-if="sortedSections.length === 0"
                    class="flex flex-col items-center justify-center px-6 py-12 text-center"
                >
                    <Search class="h-14 w-14 text-muted-foreground/50" aria-hidden="true" />
                    <h2 class="mt-5 font-display text-2xl font-semibold">Keine Ergebnisse</h2>
                    <p class="mt-2 text-muted-foreground">
                        Keine Lieder entsprechen den Filterkriterien.
                    </p>
                    <Button variant="outline" class="mt-6" @click="clearAllFilters">
                        Filter zurücksetzen
                    </Button>
                </div>

                <!-- Songs List with Sections -->
                <div v-else class="songs-list">
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
                            v-long-press="(el: HTMLElement) => openSongActions(song.id, el)"
                            type="button"
                            class="song-row group flex w-full select-none items-baseline gap-4 border-b border-border py-3.5 pl-2 pr-2 text-left transition-colors [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] last:border-b-0 hover:bg-muted active:bg-muted"
                            :data-section="section.key"
                            @click="navigateToSong(song.id)"
                            @contextmenu.prevent="openSongActions(song.id, anchorFromEvent($event))"
                        >
                            <span
                                class="number-display w-10 shrink-0 text-right text-lg leading-none"
                            >
                                <SearchHighlight
                                    v-if="song.index"
                                    :text="String(song.index)"
                                    :terms="activeSearchTerms"
                                />
                                <span
                                    v-else
                                    class="inline-block h-1.5 w-1.5 rotate-45 bg-muted-foreground/60"
                                    aria-hidden="true"
                                ></span>
                            </span>
                            <span class="flex min-w-0 flex-1 flex-col gap-1">
                                <span
                                    class="font-display text-[17px] leading-snug [overflow-wrap:break-word] [word-break:break-word]"
                                >
                                    <SearchHighlight
                                        :text="song.titel"
                                        :terms="activeSearchTerms"
                                    />
                                </span>
                                <span
                                    v-if="
                                        sortMode !== 'category' && formatCategories(song.kategorien)
                                    "
                                    class="label-micro text-muted-foreground"
                                >
                                    <SearchHighlight
                                        :text="formatCategories(song.kategorien)"
                                        :terms="activeSearchTerms"
                                    />
                                </span>
                            </span>
                            <ChevronRight
                                class="h-4 w-4 shrink-0 self-center text-muted-foreground transition group-hover:translate-x-[3px] group-hover:text-primary"
                                aria-hidden="true"
                            />
                        </button>
                    </template>
                </div>

                <!-- Last Sync Info -->
                <div v-if="lastSyncTime" class="py-6 text-center text-[13px] text-muted-foreground">
                    <p>Zuletzt synchronisiert: {{ formatSyncTime(lastSyncTime) }}</p>
                </div>
            </div>
        </main>

        <!-- Index rail: overlays <main> but stays outside it so it never scrolls;
             bounds-el hands it that box to center on. -->
        <IndexScroll
            v-if="isIndexScrollerVisible"
            :items="indexItems"
            :active-key="activeSection"
            :bounds-el="scrollRef"
            @select="scrollToSection"
        />

        <!-- Filter panel: popover from lg up, bottom sheet below -->
        <SongFilterPanel
            :is-open="showFilters"
            :anchor="filterAnchor"
            :available-categories="availableCategories"
            :selected-categories="filters.selectedCategories"
            :available-authors="availableAuthors"
            :selected-authors="filters.selectedAuthors"
            :available-melodien="availableMelodien"
            :selected-melodien="filters.selectedMelodien"
            :filter-index-range="filters.indexRange"
            :index-range="indexRange"
            :has-active-filters="hasActiveFilters"
            @close="showFilters = false"
            @toggle-category="toggleCategory"
            @toggle-author="toggleAuthor"
            @toggle-melodie="toggleMelodie"
            @set-index-range="setIndexRange"
            @clear-all="clearFiltersKeepSearch"
        />

        <!-- Sort Options -->
        <ActionSheet
            v-model:open="showSortOptions"
            title="Sortierung"
            :actions="sortSheetActions"
            :anchor="sortAnchor"
            align="end"
        />

        <!-- Song actions (long-press / right-click menu) -->
        <ActionSheet
            v-model:open="showSongActions"
            title="Aktionen"
            :actions="songSheetActions"
            :anchor="songAnchor"
        />

        <!-- Playlist Select -->
        <PlaylistSelectModal
            :is-open="showPlaylistModal"
            :song-id="selectedSongId"
            :anchor="songAnchor"
            @close="showPlaylistModal = false"
            @added="onSongAddedToPlaylist"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import type { FunctionalComponent } from 'vue';

import {
    Check,
    ChevronRight,
    Church,
    CloudDownload,
    Heart,
    ListMusic,
    Music,
    Search,
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useFavoritesStore } from '@/stores/favorites';
import { useServiceStore } from '@/stores/service';
import { useSongsStore } from '@/stores/songs';

import { useKeepAliveScroll } from '@/composables/useKeepAliveScroll';
import { useSongFiltering } from '@/composables/useSongFiltering';
import { SORT_OPTIONS, useSongSorting } from '@/composables/useSongSorting';

import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue';
import IndexScroll from '@/components/songlist/IndexScroll.vue';
import SongFilterPanel from '@/components/songlist/SongFilterPanel.vue';
import SongSectionHeader from '@/components/songlist/SongSectionHeader.vue';
import SongToolbar from '@/components/songlist/SongToolbar.vue';
import { Button } from '@/components/ui/button';
import { ActionSheet, type ActionSheetAction } from '@/components/ui/responsive-panel';
import { Spinner } from '@/components/ui/spinner';
import SearchHighlight from '@/components/utils/SearchHighlight.vue';

import type { Category } from '@/db';
import { type PanelAnchor, anchorFromEvent } from '@/lib/anchor';

const songsStore = useSongsStore();
const favoritesStore = useFavoritesStore();
const serviceStore = useServiceStore();
const { songs, isLoading, error, lastSyncTime, hasSongs } = storeToRefs(songsStore);
const router = useRouter();
const route = useRoute();

// The page's single scroll container
const scrollRef = ref<HTMLElement | null>(null);
// KeepAlive resets scrollTop on re-attach; save/restore it (Ionic parity)
useKeepAliveScroll(scrollRef);

// Filtering - applied first
const {
    filters,
    filteredSongs,
    activeSearchTerms,
    isSearchActive,
    hasActiveFilters,
    activeFilterCount,
    availableCategories,
    availableAuthors,
    availableMelodien,
    activeMelodien,
    indexRange,
    setSearchQuery,
    clearSearch,
    toggleCategory,
    setIndexRange,
    toggleAuthor,
    setAuthors,
    toggleMelodie,
    setMelodien,
    clearAllFilters,
    clearFiltersKeepSearch,
} = useSongFiltering(songs);

// Deep link from the song view: /tabs/lieder?autor=<Name> shows that author's
// songs, /tabs/lieder?weise=<Melodie-id> die Lieder auf derselben Weise. The
// parameter is a one-shot intent — it is applied and then dropped from the URL,
// because the filter itself lives on in this page (the tab shell is kept alive
// across a trip to a song). Leaving it in the URL would let a later
// back-navigation restore a filter the user has since cleared.
watch(() => route.query.autor, applyAuthorFromQuery, { immediate: true });
watch(() => route.query.weise, applyWeiseFromQuery, { immediate: true });

function applyAuthorFromQuery() {
    if (route.name !== 'Songs') return;

    const raw = route.query.autor;
    const authors = (Array.isArray(raw) ? raw : [raw]).filter((name): name is string => !!name);
    if (!authors.length) return;

    // A fresh intent: show exactly this author, not the intersection with
    // whatever was still filtered from before.
    clearAllFilters();
    setAuthors(authors);

    const { autor: _autor, ...rest } = route.query;
    router.replace({ path: route.path, query: rest });
}

function applyWeiseFromQuery() {
    if (route.name !== 'Songs') return;

    const raw = route.query.weise;
    const melodien = (Array.isArray(raw) ? raw : [raw]).filter((id): id is string => !!id);
    if (!melodien.length) return;

    // Wie beim Autor: ein frischer Wunsch ersetzt die bisherige Auswahl.
    clearAllFilters();
    setMelodien(melodien);

    const { weise: _weise, ...rest } = route.query;
    router.replace({ path: route.path, query: rest });
}

// Sorting - applied to filtered songs
const { sortMode, showHeaders, showIndexScroll, sortedSections, indexItems } =
    useSongSorting(filteredSongs);

// UI State. Each panel keeps the element (or click point) it was opened from —
// that is what its desktop popover form hangs off.
const showSortOptions = ref(false);
const sortAnchor = ref<PanelAnchor>(null);
const showFilters = ref(false);
const filterAnchor = ref<PanelAnchor>(null);
const activeSection = ref<string>('');

// Long-press / Song Actions State
const showSongActions = ref(false);
const songAnchor = ref<PanelAnchor>(null);
const showPlaylistModal = ref(false);
const selectedSongId = ref<string>('');

// Toolbar buttons toggle their panel, so a second click closes it again
function toggleFilters(anchor: PanelAnchor) {
    filterAnchor.value = anchor;
    showFilters.value = !showFilters.value;
}

function toggleSortOptions(anchor: PanelAnchor) {
    sortAnchor.value = anchor;
    showSortOptions.value = !showSortOptions.value;
}

// --- Lied der Woche (ported from the former home screen) ---
const now = new Date();

// ISO week number — used to pick a stable "song of the week"
function getIsoWeek(date: Date): number {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const diff = target.getTime() - firstThursday.getTime();
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

const songOfTheWeek = computed(() => {
    const songsWithIndex = songsStore.songs.filter((s) => s.index);
    if (!songsWithIndex.length) return null;
    const week = getIsoWeek(now);
    return songsWithIndex[week % songsWithIndex.length] ?? null;
});

const songOfTheWeekMeta = computed(() => {
    const song = songOfTheWeek.value;
    if (!song) return '';
    const category = song.kategorien?.[0]?.name ?? '';
    const verseCount = song.strophen?.length ?? 0;
    const verseLabel = verseCount === 1 ? '1 Strophe' : `${verseCount} Strophen`;
    return [category, verseLabel].filter(Boolean).join(' · ').toUpperCase();
});

function openSongOfTheWeek() {
    if (!songOfTheWeek.value) return;
    router.push(`/songs/${songOfTheWeek.value.id}`);
}

const isIndexScrollerVisible = computed(() => {
    return (
        showIndexScroll.value &&
        indexItems.value.length > 1 &&
        !isSearchActive.value &&
        !hasActiveFilters.value
    );
});

// Filled-heart icon for the "favorite" action row (class/size fall through)
const HeartFilled: FunctionalComponent = () => h(Heart, { fill: 'currentColor' });

// Action sheet actions for sort options (handler runs before the sheet closes)
const sortSheetActions = computed<ActionSheetAction[]>(() => [
    ...SORT_OPTIONS.map((option) => ({
        label: option.label,
        icon: sortMode.value === option.value ? Check : undefined,
        handler: () => {
            sortMode.value = option.value;
            // Reset active section when changing sort mode
            if (sortedSections.value.length > 0) {
                activeSection.value = sortedSections.value[0].key;
            }
        },
    })),
    {
        label: 'Abbrechen',
        role: 'cancel' as const,
    },
]);

// Song action sheet actions. `selectedSongId` deliberately survives the sheet
// closing — the playlist modal opened from the second handler still needs it.
const songSheetActions = computed<ActionSheetAction[]>(() => {
    const isFav = selectedSongId.value ? favoritesStore.isFavorite(selectedSongId.value) : false;
    const isInService = selectedSongId.value ? serviceStore.isInPlan(selectedSongId.value) : false;
    return [
        {
            label: isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen',
            icon: isFav ? HeartFilled : Heart,
            handler: () => {
                if (selectedSongId.value) {
                    favoritesStore.toggleFavorite(selectedSongId.value);
                }
            },
        },
        {
            label: isInService ? 'Aus Gottesdienst entfernen' : 'Für Gottesdienst vormerken',
            icon: Church,
            handler: () => {
                if (selectedSongId.value) toggleService(selectedSongId.value);
            },
        },
        {
            label: 'Zu Playlist hinzufügen',
            icon: ListMusic,
            handler: () => {
                showPlaylistModal.value = true;
            },
        },
        {
            label: 'Abbrechen',
            role: 'cancel' as const,
        },
    ];
});

// The Gottesdienst tab appears with the first song marked, so the toast is
// what explains where the song just went.
async function toggleService(songId: string) {
    try {
        const marked = await serviceStore.toggleSong(songId);
        toast.success(
            marked ? 'Für den Gottesdienst vorgemerkt' : 'Aus dem Gottesdienst entfernt',
            { duration: 2000 },
        );
    } catch (err) {
        console.error('Failed to update the service selection:', err);
        toast.error('Die Auswahl konnte nicht gespeichert werden.');
    }
}

// Long-press / right-click handler
function openSongActions(songId: string, anchor: PanelAnchor) {
    selectedSongId.value = songId;
    songAnchor.value = anchor;
    showSongActions.value = true;
}

function onSongAddedToPlaylist(_playlistId: string) {
    // Could show a toast notification here
}

// Vertical room reserved at the top of the scroll container: the sticky section
// divider (measured live, when shown) plus a little breathing room. The toolbar
// no longer matters here — it sits outside the scroll container.
function getStickyOffset(): number {
    const GAP = 8; // small breathing room below the header

    let offset = GAP;
    if (showHeaders.value) {
        const divider = document.querySelector('.section-header') as HTMLElement | null;
        if (divider) offset += divider.getBoundingClientRect().height;
    }
    return offset;
}

// Scroll to a specific section - always scroll to first item in section
function scrollToSection(sectionKey: string) {
    const scrollEl = scrollRef.value;
    if (!scrollEl) {
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
    // from where it currently is to just below the scroll container's top edge
    // (clearing the sticky section header, if any).
    const delta =
        firstItem.getBoundingClientRect().top -
        (scrollEl.getBoundingClientRect().top + getStickyOffset());

    scrollEl.scrollTo({ top: Math.max(0, scrollEl.scrollTop + delta), behavior: 'smooth' });
}

// Handle scroll events to update active section (rAF-throttled)
let scrollTickPending = false;

function onScroll() {
    if (scrollTickPending) return;
    scrollTickPending = true;
    requestAnimationFrame(() => {
        scrollTickPending = false;
        updateActiveSection();
    });
}

function updateActiveSection() {
    const scrollEl = scrollRef.value;
    if (!scrollEl) return;
    const containerTop = scrollEl.getBoundingClientRect().top;

    // Find the section that's currently in view: last section whose anchor sits
    // at most 150px below the container's top edge (same heuristic as before,
    // now in scroll-container-relative coordinates)
    for (let i = sortedSections.value.length - 1; i >= 0; i--) {
        const section = sortedSections.value[i];
        const element = showHeaders.value
            ? document.getElementById(`section-${section.key}`)
            : (document.querySelector(`[data-section="${section.key}"]`) as HTMLElement | null);

        if (element && element.getBoundingClientRect().top - containerTop <= 150) {
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
