import { type Ref, computed, ref } from 'vue';

import type { Category, Song } from '@/db';

export type SortMode = 'index' | 'alphabetical' | 'category';

export interface SortOption {
    value: SortMode;
    label: string;
    icon: string;
    showHeaders: boolean;
    showIndexScroll: boolean; // Whether to show the index scroll sidebar
}

export const SORT_OPTIONS: SortOption[] = [
    {
        value: 'index',
        label: 'Nummer',
        icon: 'list-outline',
        showHeaders: false,
        showIndexScroll: true,
    },
    {
        value: 'alphabetical',
        label: 'Alphabetisch',
        icon: 'text-outline',
        showHeaders: true,
        showIndexScroll: true,
    },
    {
        value: 'category',
        label: 'Kategorie',
        icon: 'pricetag-outline',
        showHeaders: true,
        showIndexScroll: false,
    },
];

// Minimum number of songs for a category to be shown separately
// Categories with fewer songs will be merged into "Sonstige"
const MIN_CATEGORY_ENTRIES = 0;
const NUMBER_SCROLL_GROUP_SIZE = 15; // Number of songs per index group for number sorting

export interface SongSection {
    key: string;
    label: string;
    songs: Song[];
    categoryIndex?: string; // For category sorting
}

export interface IndexItem {
    key: string;
    label: string;
}

/**
 * Composable for song sorting and grouping logic
 */
export function useSongSorting(songs: Ref<Song[]>) {
    const sortMode = ref<SortMode>('index');

    // Get the current sort option config
    const currentSortOption = computed(
        () => SORT_OPTIONS.find((opt) => opt.value === sortMode.value) || SORT_OPTIONS[0],
    );

    // Check if headers should be shown for current sort mode
    const showHeaders = computed(() => currentSortOption.value.showHeaders);

    // Check if index scroll should be shown for current sort mode
    const showIndexScroll = computed(() => currentSortOption.value.showIndexScroll);

    // Sort and group songs based on current mode
    const sortedSections = computed((): SongSection[] => {
        const songList = songs.value;

        switch (sortMode.value) {
            case 'index':
                return groupByIndex(songList);
            case 'alphabetical':
                return groupByAlphabet(songList);
            case 'category':
                return groupByCategory(songList);
            default:
                return groupByIndex(songList);
        }
    });

    // Flat list of all songs in sorted order
    const sortedSongs = computed((): Song[] => {
        return sortedSections.value.flatMap((section) => section.songs);
    });

    // Index items for the scroll indicator
    const indexItems = computed((): IndexItem[] => {
        return sortedSections.value.map((section) => ({
            key: section.key,
            label: section.label,
        }));
    });

    return {
        sortMode,
        currentSortOption,
        showHeaders,
        showIndexScroll,
        sortedSections,
        sortedSongs,
        indexItems,
    };
}

/**
 * Group songs by index number into blocks of NUMBER_SCROLL_GROUP_SIZE.
 *
 * The group key/label is the index of the FIRST song in the block, so the
 * scroller label matches the songs it points at: e.g. with a size of 15,
 * "300" → songs 300-314. (The very first block, 1 .. size-1, is labelled "1".)
 */
function groupByIndex(songs: Song[]): SongSection[] {
    const sorted = [...songs].sort((a, b) => a.index - b.index);
    const groups = new Map<number, Song[]>();

    for (const song of sorted) {
        // Block start aligned to the group size: 0, 15, 30, ... The 0 block
        // starts at song 1, so label it "1" rather than "0".
        const blockStart =
            Math.floor(song.index / NUMBER_SCROLL_GROUP_SIZE) * NUMBER_SCROLL_GROUP_SIZE;
        const key = blockStart === 0 ? 1 : blockStart;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(song);
    }

    // Convert to sections with proper labels
    return Array.from(groups.entries())
        .sort(([a], [b]) => a - b)
        .map(([key, groupSongs]) => ({
            key: String(key),
            label: String(key), // "1", "15", "30", etc.
            songs: groupSongs,
        }));
}

/**
 * Group songs alphabetically by first letter of title
 */
function groupByAlphabet(songs: Song[]): SongSection[] {
    const sorted = [...songs].sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
    const groups = new Map<string, Song[]>();

    for (const song of sorted) {
        const firstChar = song.titel.charAt(0).toUpperCase();
        // Handle numbers and special characters
        const letter = /[A-ZÄÖÜ]/.test(firstChar) ? firstChar : '#';

        if (!groups.has(letter)) {
            groups.set(letter, []);
        }
        groups.get(letter)!.push(song);
    }

    // Sort alphabetically, with # at the end
    return Array.from(groups.entries())
        .sort(([a], [b]) => {
            if (a === '#') return 1;
            if (b === '#') return -1;
            return a.localeCompare(b, 'de');
        })
        .map(([letter, groupSongs]) => ({
            key: letter,
            label: letter,
            songs: groupSongs,
        }));
}

/**
 * Group songs by category
 * Categories with fewer than MIN_CATEGORY_ENTRIES songs are merged into "Sonstige"
 */
function groupByCategory(songs: Song[]): SongSection[] {
    // Map: categoryIndex -> { category info, songs }
    const groups = new Map<string, { category: Category; songs: Song[] }>();
    const uncategorizedSongs: Song[] = [];

    for (const song of songs) {
        if (song.kategorien.length === 0) {
            uncategorizedSongs.push(song);
            continue;
        }

        // Add song to each of its categories
        for (const category of song.kategorien) {
            if (!groups.has(category.index)) {
                groups.set(category.index, { category, songs: [] });
            }
            groups.get(category.index)!.songs.push(song);
        }
    }

    // Separate categories into main and small ones
    const mainCategories: SongSection[] = [];
    const smallCategorySongs: Song[] = [];
    const seenSongIds = new Set<string>(); // Avoid duplicates in "Sonstige"

    for (const [, { category, songs: categorySongs }] of groups) {
        if (categorySongs.length >= MIN_CATEGORY_ENTRIES) {
            mainCategories.push({
                key: String(category.index),
                label: category.name?.trim() || 'Unbenannt',
                categoryIndex: category.index,
                songs: [...categorySongs].sort((a, b) => a.titel.localeCompare(b.titel, 'de')),
            });
        } else {
            // Add to "Sonstige" but avoid duplicates
            for (const song of categorySongs) {
                if (!seenSongIds.has(song.id)) {
                    seenSongIds.add(song.id);
                    smallCategorySongs.push(song);
                }
            }
        }
    }

    console.log(
        'Main categories:',
        mainCategories.map((c) => ({
            index: c.categoryIndex,
            label: c.label,
            songCount: c.songs.length,
        })),
    );
    console.log('Small category songs count:', smallCategorySongs.length);

    // Sort main categories by their index (convert string to number for comparison)
    mainCategories.sort((a, b) => {
        const aIndex = parseInt(a.categoryIndex ?? '0', 10);
        const bIndex = parseInt(b.categoryIndex ?? '0', 10);
        return aIndex - bIndex;
    });

    // Add "Sonstige" if there are small category songs
    if (smallCategorySongs.length > 0) {
        mainCategories.push({
            key: 'sonstige',
            label: 'Sonstige',
            songs: [...smallCategorySongs].sort((a, b) => a.titel.localeCompare(b.titel, 'de')),
        });
    }

    // Add "Unkategorisiert" at the end if there are uncategorized songs
    if (uncategorizedSongs.length > 0) {
        mainCategories.push({
            key: 'unkategorisiert',
            label: 'Unkategorisiert',
            songs: [...uncategorizedSongs].sort((a, b) => a.titel.localeCompare(b.titel, 'de')),
        });
    }

    return mainCategories;
}
