<template>
    <!-- Non-scrolling page header block: title/search row + chips + result count.
         Lives OUTSIDE the scroll container (list rows scroll underneath the hairline). -->
    <div
        class="song-toolbar shrink-0 border-b border-border bg-background pt-[env(safe-area-inset-top)]"
    >
        <div class="mx-auto flex h-14 w-full max-w-xl items-center gap-1 px-2 sm:px-3">
            <!-- Back button (hidden on tab roots) -->
            <Button
                v-if="showBack"
                variant="ghost"
                size="icon"
                class="shrink-0"
                aria-label="Zurück"
                @click="$emit('back')"
            >
                <ArrowLeft aria-hidden="true" />
            </Button>

            <!-- Title or Search Input -->
            <Transition name="title-fade" mode="out-in" @after-enter="focusSearchInput">
                <div
                    v-if="!isSearchExpanded"
                    key="title"
                    class="min-w-0 flex-1"
                    :class="{ 'pl-2': !showBack }"
                >
                    <h1 class="truncate font-display text-xl font-semibold">{{ title }}</h1>
                </div>
                <div
                    v-else
                    key="search"
                    class="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-muted px-3"
                >
                    <Search class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        ref="searchInputRef"
                        v-model="localSearchQuery"
                        type="text"
                        class="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
                        placeholder="Suchen..."
                        @input="onSearchInput"
                        @keyup.escape="collapseSearch"
                    />
                    <Button
                        v-if="localSearchQuery"
                        variant="ghost"
                        size="icon-sm"
                        class="-mr-1.5 shrink-0 text-muted-foreground"
                        aria-label="Suche löschen"
                        @click="clearSearch"
                    >
                        <CircleX aria-hidden="true" />
                    </Button>
                </div>
            </Transition>

            <!-- Action buttons -->
            <div class="flex shrink-0 items-center">
                <!-- Filter button with badge (hidden when search is expanded) -->
                <Transition name="action-fade">
                    <Button
                        v-if="!isSearchExpanded"
                        variant="ghost"
                        size="icon"
                        :class="hasActiveFilters ? 'relative text-primary' : 'relative'"
                        aria-label="Filter öffnen"
                        @click="$emit('openFilters')"
                    >
                        <SlidersHorizontal aria-hidden="true" />
                        <span
                            v-if="activeFilterCount > 0"
                            class="absolute right-0.5 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-semibold leading-none text-destructive-foreground"
                        >
                            {{ activeFilterCount }}
                        </span>
                    </Button>
                </Transition>

                <!-- Sort button with current mode indicator (hidden when search is expanded) -->
                <Transition name="action-fade">
                    <button
                        v-if="!isSearchExpanded"
                        type="button"
                        class="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
                        aria-label="Sortierung ändern"
                        @click="$emit('openSort')"
                    >
                        <ArrowUpDown class="h-[18px] w-[18px]" aria-hidden="true" />
                        <span
                            class="absolute bottom-1 right-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-primary text-primary-foreground"
                            aria-hidden="true"
                        >
                            <component :is="currentSortIcon" class="h-[9px] w-[9px]" />
                        </span>
                    </button>
                </Transition>

                <!-- Search toggle (always visible, on the right) -->
                <Button
                    variant="ghost"
                    size="icon"
                    :class="isSearchExpanded ? 'text-primary' : undefined"
                    :aria-label="isSearchExpanded ? 'Suche schließen' : 'Suchen'"
                    @click="toggleSearch"
                >
                    <X v-if="isSearchExpanded" aria-hidden="true" />
                    <Search v-else aria-hidden="true" />
                </Button>
            </div>
        </div>

        <!-- Active filters chips -->
        <Transition name="chips-slide">
            <div
                v-if="showFilterChips"
                class="mx-auto flex w-full max-w-xl flex-wrap gap-1.5 px-3 pb-2"
            >
                <button
                    v-if="searchQuery"
                    type="button"
                    :class="[chipBase, 'border-primary/40 bg-primary/10 text-primary']"
                    @click="$emit('clearSearch')"
                >
                    <Search class="h-3 w-3" aria-hidden="true" />
                    <span>"{{ truncate(searchQuery, 15) }}"</span>
                    <CircleX class="h-3 w-3 opacity-70" aria-hidden="true" />
                </button>

                <button
                    v-for="category in selectedCategories"
                    :key="category"
                    type="button"
                    :class="[chipBase, 'border-transparent bg-secondary text-secondary-foreground']"
                    @click="$emit('toggleCategory', category)"
                >
                    <Tag class="h-3 w-3" aria-hidden="true" />
                    <span>{{ truncate(category, 12) }}</span>
                    <CircleX class="h-3 w-3 opacity-70" aria-hidden="true" />
                </button>

                <button
                    v-if="filterIndexRange"
                    type="button"
                    :class="[chipBase, 'border-gold/40 text-gold']"
                    @click="$emit('setIndexRange', null)"
                >
                    <List class="h-3 w-3" aria-hidden="true" />
                    <span>{{ filterIndexRange.min }}-{{ filterIndexRange.max }}</span>
                    <CircleX class="h-3 w-3 opacity-70" aria-hidden="true" />
                </button>
            </div>
        </Transition>

        <!-- Results count -->
        <Transition name="results-fade">
            <div
                v-if="showResultsCount"
                class="mx-auto w-full max-w-xl px-4 pb-2 text-[13px] text-muted-foreground"
            >
                <span>{{ resultCount }} {{ resultCount === 1 ? 'Lied' : 'Lieder' }} gefunden</span>
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { FunctionalComponent } from 'vue';

import {
    ALargeSmall,
    ArrowLeft,
    ArrowUpDown,
    CircleX,
    List,
    Search,
    SlidersHorizontal,
    Tag,
    X,
} from 'lucide-vue-next';

import type { SortMode } from '@/composables/useSongSorting';

import { Button } from '@/components/ui/button';

const props = withDefaults(
    defineProps<{
        title: string;
        searchQuery: string;
        selectedCategories: string[];
        filterIndexRange: { min: number; max: number } | null;
        activeFilterCount: number;
        hasActiveFilters: boolean;
        sortMode: SortMode;
        resultCount: number;
        totalCount: number;
        showBack?: boolean;
    }>(),
    {
        showBack: true,
    },
);

const emit = defineEmits<{
    (e: 'back'): void;
    (e: 'search', query: string): void;
    (e: 'clearSearch'): void;
    (e: 'openFilters'): void;
    (e: 'openSort'): void;
    (e: 'toggleCategory', category: string): void;
    (e: 'setIndexRange', range: { min: number; max: number } | null): void;
}>();

// Shared chip styling; the color classes keep the original filter-type distinction
// (search = primary, category = secondary, boolean/range = flourish gold).
const chipBase =
    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors';

// Sort mode icons mapping (lucide equivalents of the old ionicons)
const sortModeIcons: Record<SortMode, FunctionalComponent> = {
    index: List,
    alphabetical: ALargeSmall,
    category: Tag,
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
        props.searchQuery || props.selectedCategories.length > 0 || props.filterIndexRange !== null
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

// With mode="out-in" the input is only inserted after the title finished
// leaving, so the nextTick focus above can miss it — focus again once the
// enter transition lands.
function focusSearchInput() {
    if (isSearchExpanded.value) {
        searchInputRef.value?.focus();
    }
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
/* Animations (plain CSS, unchanged from the Ionic version) */
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
