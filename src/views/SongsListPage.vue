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

        <!-- Index rail: overlays <main> but stays outside it so it never scrolls;
             bounds-el hands it that box to center on. It is absolutely
             positioned at z-30, so it paints over the list wherever it sits in
             the markup — and it sits here, ahead of the list, because that is
             where it belongs in the tab order. Behind the list it would be a
             jump control a keyboard only reaches after scrolling past
             everything it jumps over. -->
        <IndexScroll
            v-if="isIndexScrollerVisible"
            :items="indexItems"
            :active-key="activeSection"
            :bounds-el="scrollRef"
            @select="scrollToSection"
        />

        <main
            ref="scrollRef"
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            :class="{ 'scrollbar-none': isIndexScrollerVisible }"
            @scroll="onScroll"
        >
            <PullToRefreshIndicator
                :distance="pullDistance"
                :is-refreshing="isPullRefreshing"
                :is-pulling="isPulling"
                :is-armed="isPullArmed"
                :status-label="syncStatusLabel"
            />

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
                                class="mt-1.5 block text-[0.6875rem] tracking-[0.14em] text-muted-foreground"
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
                    <p class="mt-2 max-w-96 text-muted-foreground">
                        Laden Sie das Gesangbuch einmal herunter, um es offline zu nutzen — über die
                        Schaltfläche oder indem Sie die Liste nach unten ziehen.
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
                        <!-- Section heading. Always in the document — it is how a
                             screen reader walks 500 hymns — but only inked in the
                             sort modes where a divider tells the reader something
                             the rows do not already say. -->
                        <SongSectionHeader
                            :section-key="section.key"
                            :label="section.label"
                            :spoken-label="section.spokenLabel"
                            :visually-hidden="!showHeaders"
                        />

                        <!-- Songs in this section. The row is a wrapper, not the
                             button itself: the `⋯` menu trigger has to sit beside
                             the button that opens the song, never inside it. -->
                        <div
                            v-for="song in section.songs"
                            :key="song.id"
                            class="song-row group flex w-full items-center border-b border-border pr-2 transition-colors last:border-b-0 hover:bg-muted active:bg-muted data-[menu-open]:bg-muted"
                            :data-section="section.key"
                            :data-menu-open="
                                showSongActions && selectedSongId === song.id ? '' : undefined
                            "
                            @contextmenu.prevent="openSongActions(song.id, anchorFromEvent($event))"
                        >
                            <button
                                v-long-press="(el: HTMLElement) => openSongActions(song.id, el)"
                                type="button"
                                class="flex min-w-0 flex-1 select-none items-baseline gap-4 py-3.5 pl-2 pr-2 text-left [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
                                @click="navigateToSong(song.id)"
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
                                        class="font-display text-[1.0625rem] leading-snug [overflow-wrap:break-word] [word-break:break-word]"
                                    >
                                        <SearchHighlight
                                            :text="song.titel"
                                            :terms="activeSearchTerms"
                                        />
                                    </span>
                                    <span
                                        v-if="
                                            sortMode !== 'category' &&
                                            formatCategories(song.kategorien)
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
                                    class="h-4 w-4 shrink-0 self-center text-muted-foreground transition group-hover:text-primary group-data-[menu-open]:text-primary lg:group-hover:-translate-x-7 lg:group-data-[menu-open]:-translate-x-7"
                                    aria-hidden="true"
                                />
                            </button>

                            <RowActionsTrigger
                                overlay
                                :label="`Aktionen für ${song.titel}`"
                                :active="showSongActions && selectedSongId === song.id"
                                @open="openSongActions(song.id, $event)"
                            />
                        </div>
                    </template>
                </div>

                <!-- Last Sync Info -->
                <div
                    v-if="lastSyncTime"
                    class="py-6 text-center text-[0.8125rem] text-muted-foreground"
                >
                    <p>Zuletzt synchronisiert: {{ formatSyncTime(lastSyncTime) }}</p>
                </div>
            </div>
        </main>

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

        <!-- Song actions (row `⋯` / long-press / right-click) -->
        <ActionSheet
            v-model:open="showSongActions"
            title="Aktionen"
            :actions="songSheetActions"
            :anchor="songAnchor"
            align="end"
        />

        <!-- Which verses this service sings -->
        <ServiceVersePanel
            :is-open="showVersePanel"
            :song="selectedSong"
            :anchor="songAnchor"
            @close="showVersePanel = false"
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
    ListOrdered,
    Music,
    Search,
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useFavoritesStore } from '@/stores/favorites';
import { useNavigationContextStore } from '@/stores/navigationContext';
import { useServiceStore } from '@/stores/service';
import { useSongsStore } from '@/stores/songs';

import { useCurrentDate } from '@/composables/useCurrentDate';
import { useKeepAliveScroll } from '@/composables/useKeepAliveScroll';
import { usePullToRefresh } from '@/composables/usePullToRefresh';
import { useSessionAccess } from '@/composables/useSessionAccess';
import { useSongFiltering } from '@/composables/useSongFiltering';
import { SORT_OPTIONS, useSongSorting } from '@/composables/useSongSorting';

import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue';
import ServiceVersePanel from '@/components/service/ServiceVersePanel.vue';
import PullToRefreshIndicator from '@/components/shell/PullToRefreshIndicator.vue';
import IndexScroll from '@/components/songlist/IndexScroll.vue';
import SongFilterPanel from '@/components/songlist/SongFilterPanel.vue';
import SongSectionHeader from '@/components/songlist/SongSectionHeader.vue';
import SongToolbar from '@/components/songlist/SongToolbar.vue';
import { Button } from '@/components/ui/button';
import {
    ActionSheet,
    type ActionSheetAction,
    RowActionsTrigger,
} from '@/components/ui/responsive-panel';
import { Spinner } from '@/components/ui/spinner';
import SearchHighlight from '@/components/utils/SearchHighlight.vue';

import type { Category } from '@/db';
import { type PanelAnchor, anchorFromEvent } from '@/lib/anchor';
import { formatVerseNumbers } from '@/services/servicePlans';
import { pickSongOfTheWeek } from '@/utils/songOfTheWeek';

const songsStore = useSongsStore();
const favoritesStore = useFavoritesStore();
const serviceStore = useServiceStore();
const navigationContext = useNavigationContextStore();
const { songs, isLoading, error, lastSyncTime, hasSongs, isSyncing, syncProgress } =
    storeToRefs(songsStore);
const { isLoggedIn } = useSessionAccess();
const router = useRouter();
const route = useRoute();

// The page's single scroll container
const scrollRef = ref<HTMLElement | null>(null);
// KeepAlive resets scrollTop on re-attach; save/restore it (Ionic parity)
useKeepAliveScroll(scrollRef);

// Pull-to-refresh: the list is where a reader notices that content is missing
// or out of date, so it is also where the sync belongs. The toolbar has no
// sync button by design — this is the gesture that replaces it.
const {
    distance: pullDistance,
    isRefreshing: isPullRefreshing,
    isPulling,
    isArmed: isPullArmed,
} = usePullToRefresh(scrollRef, syncSongs, { enabled: () => !isSyncing.value });

const syncStatusLabel = computed(() => {
    if (syncProgress.value.phase === 'songs') return 'Lieder werden geladen…';
    if (syncProgress.value.phase === 'files' && syncProgress.value.total > 0) {
        return `${syncProgress.value.current} von ${syncProgress.value.total} Dateien`;
    }
    return 'Wird synchronisiert…';
});

async function syncSongs() {
    if (isSyncing.value) return;

    // The gesture is available to everyone, because a reader pulling the list
    // has no way of knowing their session lapsed. It answers rather than fails:
    // the book is fine, only the abgleich needs an account.
    if (!isLoggedIn.value) {
        toast.info('Zum Synchronisieren ist eine Anmeldung erforderlich.', {
            description: 'Ihr heruntergeladenes Gesangbuch bleibt vollständig nutzbar.',
            action: { label: 'Anmelden', onClick: () => router.push('/login') },
        });
        return;
    }

    try {
        await songsStore.syncAll();
        if (songsStore.failedFiles.length > 0) {
            toast.warning('Einige Notendateien fehlen noch.', {
                description: 'Unter Synchronisieren können Sie sie erneut laden.',
                action: { label: 'Öffnen', onClick: () => router.push('/download') },
            });
            return;
        }
        toast.success('Gesangbuch ist aktuell', { duration: 2000 });
    } catch (err) {
        console.error('Pull-to-refresh sync failed:', err);
        toast.error('Die Synchronisierung ist fehlgeschlagen.', {
            description: 'Bitte prüfen Sie die Internetverbindung.',
        });
    }
}

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
const { sortMode, showHeaders, showIndexScroll, sortedSections, sortedSongs, indexItems } =
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
const showVersePanel = ref(false);
const selectedSongId = ref<string>('');

// The song the action sheet is about — the Strophenwahl needs the record, not
// just the id, and the sheet's own entries need to know how long the hymn is.
const selectedSong = computed(
    () => songs.value.find((song) => song.id === selectedSongId.value) ?? null,
);

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
// The date is a live value: the page can stay open for days on a lectern.
const today = useCurrentDate();

const songOfTheWeek = computed(() => pickSongOfTheWeek(songs.value, today.value));

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
    navigateToSong(songOfTheWeek.value.id);
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
    // A hymn of one verse has nothing to choose, so it is offered no Strophenwahl.
    const canChooseVerses = (selectedSong.value?.strophen.length ?? 0) > 1;
    const verses = selectedSongId.value ? serviceStore.versesFor(selectedSongId.value) : null;

    // Two subjects, drawn as two blocks. Favoriten and Playlisten are the
    // reader's own shelves, kept for as long as they like; the Gottesdienst
    // rows speak for one service and clear themselves when the day is over.
    // Telling one from the other at a glance is the whole point of the rule
    // between them.
    return [
        {
            label: isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen',
            icon: isFav ? HeartFilled : Heart,
            group: 'collection',
            handler: () => {
                if (selectedSongId.value) {
                    favoritesStore.toggleFavorite(selectedSongId.value);
                }
            },
        },
        {
            label: 'Zu Playlist hinzufügen',
            icon: ListMusic,
            group: 'collection',
            handler: () => {
                showPlaylistModal.value = true;
            },
        },
        // Marking and choosing verses are two errands, not one. Nearly every
        // Sunday the whole hymn is sung, so marking it is one tap and asks
        // nothing; the Strophenwahl sits under it for the rarer Sunday that
        // wants three of seven, and marks the song itself when it is saved.
        ...(!isInService
            ? [
                  {
                      label: 'Für Gottesdienst vormerken',
                      icon: Church,
                      group: 'service',
                      handler: () => markForService(),
                  },
              ]
            : []),
        ...(canChooseVerses
            ? [
                  {
                      label:
                          isInService && verses
                              ? `Strophen wählen · ${formatVerseNumbers(verses)}`
                              : 'Strophen wählen',
                      icon: ListOrdered,
                      group: 'service',
                      handler: () => {
                          showVersePanel.value = true;
                      },
                  },
              ]
            : []),
        ...(isInService
            ? [
                  {
                      label: 'Aus Gottesdienst entfernen',
                      icon: Church,
                      group: 'service',
                      handler: () => removeFromService(),
                  },
              ]
            : []),
        {
            label: 'Abbrechen',
            role: 'cancel' as const,
        },
    ];
});

// The Gottesdienst tab appears with the first song marked, so the toast is
// what explains where the song just went.
async function markForService() {
    if (!selectedSongId.value) return;

    try {
        await serviceStore.markSong(selectedSongId.value);
        toast.success('Für den Gottesdienst vorgemerkt', { duration: 2000 });
    } catch (err) {
        console.error('Failed to update the service selection:', err);
        toast.error('Die Auswahl konnte nicht gespeichert werden.');
    }
}

async function removeFromService() {
    if (!selectedSongId.value) return;
    try {
        await serviceStore.removeSong(selectedSongId.value);
        toast.success('Aus dem Gottesdienst entfernt', { duration: 2000 });
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

// What the bar under a song calls this list. A reader who searched or filtered
// is paging through what they found, and the bar should say so rather than
// claim the whole list.
const browsingLabel = computed(() => {
    if (isSearchActive.value) return 'Suchergebnisse';
    if (hasActiveFilters.value) return 'Gefilterte Lieder';
    return 'Liederliste';
});

// Navigate to song detail page. The list as it is on screen — sorted and
// filtered as the reader left it — goes with them, so Vor and Zurück on the
// song page walk these rows in this order.
function navigateToSong(songId: string) {
    navigationContext.setContext({
        kind: 'list',
        label: browsingLabel.value,
        songIds: sortedSongs.value.map((song) => song.id),
    });
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
