import { type Ref, computed, ref } from 'vue';

import type { Song } from '@/db';
import { authorFilterName } from '@/utils/authorFormat';

export interface FilterState {
    searchQuery: string;
    selectedCategories: string[]; // Category names
    indexRange: { min: number; max: number } | null;
    selectedAuthors: string[]; // Author full names
}

export interface FilterOption {
    label: string;
    value: string;
    count?: number;
}

// A factory, not a shared constant: toggleCategory/toggleAuthor mutate the
// arrays in place, so handing out the same array instance would let the live
// state pollute the defaults — and every "zurücksetzen" would restore the
// polluted arrays instead of empty ones.
function createDefaultFilters(): FilterState {
    return {
        searchQuery: '',
        selectedCategories: [],
        indexRange: null,
        selectedAuthors: [],
    };
}

/**
 * Composable for song filtering logic
 */
export function useSongFiltering(songs: Ref<Song[]>) {
    // Filter state
    const filters = ref<FilterState>(createDefaultFilters());

    // Search is active when query is not empty
    const isSearchActive = computed(() => filters.value.searchQuery.trim().length > 0);

    // Check if any filter is active
    const hasActiveFilters = computed(() => {
        const f = filters.value;
        return (
            f.selectedCategories.length > 0 || f.indexRange !== null || f.selectedAuthors.length > 0
        );
    });

    // Count of active filters (for badge)
    const activeFilterCount = computed(() => {
        const f = filters.value;
        let count = 0;
        if (f.selectedCategories.length > 0) count++;
        if (f.indexRange !== null) count++;
        if (f.selectedAuthors.length > 0) count++;
        return count;
    });

    // Available categories from songs (for filter options)
    const availableCategories = computed((): FilterOption[] => {
        const categoryCount = new Map<string, number>();

        for (const song of songs.value) {
            for (const cat of song.kategorien) {
                categoryCount.set(cat.name, (categoryCount.get(cat.name) || 0) + 1);
            }
        }

        return Array.from(categoryCount.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'de'))
            .map(([name, count]) => ({
                label: name,
                value: name,
                count,
            }));
    });

    // Available authors from songs (for filter options)
    const availableAuthors = computed((): FilterOption[] => {
        const authorCount = new Map<string, number>();

        for (const song of songs.value) {
            for (const author of [...song.textAutoren, ...song.melodieAutoren]) {
                const fullName = authorFilterName(author);
                if (fullName) {
                    authorCount.set(fullName, (authorCount.get(fullName) || 0) + 1);
                }
            }
        }

        return Array.from(authorCount.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'de'))
            .map(([name, count]) => ({
                label: name,
                value: name,
                count,
            }));
    });

    // Index range from songs
    const indexRange = computed(() => {
        if (songs.value.length === 0) return { min: 1, max: 100 };
        const indices = songs.value.map((s) => s.index);
        return {
            min: Math.min(...indices),
            max: Math.max(...indices),
        };
    });

    // Apply all filters to songs
    const filteredSongs = computed((): Song[] => {
        let result = songs.value;
        const f = filters.value;

        // Search filter
        if (f.searchQuery.trim()) {
            const query = f.searchQuery.toLowerCase().trim();
            result = result.filter((song) => {
                // Search in title
                if (song.titel.toLowerCase().includes(query)) return true;

                // Search in categories
                if (song.kategorien.some((cat) => cat.name.toLowerCase().includes(query)))
                    return true;

                // Search in authors
                const allAuthors = [...song.textAutoren, ...song.melodieAutoren];
                if (
                    allAuthors.some(
                        (a) =>
                            a.vorname?.toLowerCase().includes(query) ||
                            a.nachname?.toLowerCase().includes(query),
                    )
                )
                    return true;

                // Search in song index
                if (String(song.index).includes(query)) return true;

                return false;
            });
        }

        // Category filter
        if (f.selectedCategories.length > 0) {
            result = result.filter((song) =>
                song.kategorien.some((cat) => f.selectedCategories.includes(cat.name)),
            );
        }

        // Index range filter
        if (f.indexRange) {
            result = result.filter(
                (song) => song.index >= f.indexRange!.min && song.index <= f.indexRange!.max,
            );
        }

        // Author filter
        if (f.selectedAuthors.length > 0) {
            result = result.filter((song) => {
                const allAuthors = [...song.textAutoren, ...song.melodieAutoren];
                return allAuthors.some((a) => f.selectedAuthors.includes(authorFilterName(a)));
            });
        }

        return result;
    });

    // Actions
    function setSearchQuery(query: string) {
        filters.value.searchQuery = query;
    }

    function clearSearch() {
        filters.value.searchQuery = '';
    }

    function toggleCategory(categoryName: string) {
        const idx = filters.value.selectedCategories.indexOf(categoryName);
        if (idx >= 0) {
            filters.value.selectedCategories.splice(idx, 1);
        } else {
            filters.value.selectedCategories.push(categoryName);
        }
    }

    function setIndexRange(range: { min: number; max: number } | null) {
        filters.value.indexRange = range;
    }

    function toggleAuthor(authorName: string) {
        const idx = filters.value.selectedAuthors.indexOf(authorName);
        if (idx >= 0) {
            filters.value.selectedAuthors.splice(idx, 1);
        } else {
            filters.value.selectedAuthors.push(authorName);
        }
    }

    // Replaces the whole author selection. This is what a deep link uses (a tap
    // on an author in the song view): it shows that one author, rather than
    // adding them to whatever was selected before.
    function setAuthors(authorNames: string[]) {
        filters.value.selectedAuthors = [...authorNames];
    }

    function clearAllFilters() {
        filters.value = createDefaultFilters();
    }

    function clearFiltersKeepSearch() {
        const searchQuery = filters.value.searchQuery;
        filters.value = { ...createDefaultFilters(), searchQuery };
    }

    return {
        // State
        filters,
        filteredSongs,

        // Computed
        isSearchActive,
        hasActiveFilters,
        activeFilterCount,
        availableCategories,
        availableAuthors,
        indexRange,

        // Actions
        setSearchQuery,
        clearSearch,
        toggleCategory,
        setIndexRange,
        toggleAuthor,
        setAuthors,
        clearAllFilters,
        clearFiltersKeepSearch,
    };
}
