import { type Ref, computed, ref } from 'vue';

import type { Song } from '@/db';
import { authorFilterName } from '@/utils/authorFormat';
import { foldForSearch, matchesTerms, searchTerms } from '@/utils/search';

export interface FilterState {
    searchQuery: string;
    selectedCategories: string[]; // Category names
    indexRange: { min: number; max: number } | null;
    selectedAuthors: string[]; // Author full names
    selectedMelodien: string[]; // Melodie-IDs (die Weise, nicht ihr Titel)
}

export interface FilterOption {
    label: string;
    value: string;
    count?: number;
}

/** Eine Weise des Bestands: die Melodie, unter der ihre Lieder zusammenfinden. */
export interface Melodie {
    id: string;
    titel: string;
    /** Die Choralbuchnummer — im Druck die kleinere Zahl unter der Liednummer. */
    nummer: number | null;
    /** Wie viele Lieder auf dieser Weise stehen. */
    count: number;
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
        selectedMelodien: [],
    };
}

/**
 * Die Felder eines Liedes, in denen die Suche nachsieht — Titel, Liednummer,
 * Kategorien und die beteiligten Autoren. Der Autor steht hier mit vollem Namen
 * (nicht Vor- und Nachname getrennt wie früher), damit „johann bach" als zwei
 * UND-verknüpfte Wörter aufgeht.
 */
export function songSearchFields(song: Song): string[] {
    return [
        song.titel,
        song.index ? String(song.index) : '',
        ...song.kategorien.map((cat) => cat.name),
        ...[...song.textAutoren, ...song.melodieAutoren].map(authorFilterName),
    ].filter(Boolean);
}

// Die gefalteten Suchfelder hängen am Lied selbst: gefiltert wird bei jedem
// Tastendruck über den ganzen Bestand, und die Faltung ist daran der teuerste
// Teil. Ein Sync tauscht die Lied-Objekte aus und damit auch ihre Einträge —
// deshalb eine WeakMap und kein nach Hand zu leerender Cache.
const foldedFields = new WeakMap<Song, string[]>();

function songSearchHaystack(song: Song): string[] {
    let folded = foldedFields.get(song);
    if (!folded) {
        folded = songSearchFields(song).map((field) => foldForSearch(field));
        foldedFields.set(song, folded);
    }
    return folded;
}

/** Trifft die Eingabe dieses Lied? `terms` kommt aus `searchTerms`. */
export function songMatchesTerms(song: Song, terms: string[]): boolean {
    return matchesTerms(terms, songSearchHaystack(song));
}

/**
 * Composable for song filtering logic
 */
export function useSongFiltering(songs: Ref<Song[]>) {
    // Filter state
    const filters = ref<FilterState>(createDefaultFilters());

    // Die Suchwörter der Eingabe, einmal zerlegt: sie filtern die Liste und
    // markieren anschließend die Treffer darin.
    const activeSearchTerms = computed(() => searchTerms(filters.value.searchQuery));

    // Search is active when the query holds at least one searchable word
    const isSearchActive = computed(() => activeSearchTerms.value.length > 0);

    // Check if any filter is active
    const hasActiveFilters = computed(() => {
        const f = filters.value;
        return (
            f.selectedCategories.length > 0 ||
            f.indexRange !== null ||
            f.selectedAuthors.length > 0 ||
            f.selectedMelodien.length > 0
        );
    });

    // Count of active filters (for badge)
    const activeFilterCount = computed(() => {
        const f = filters.value;
        let count = 0;
        if (f.selectedCategories.length > 0) count++;
        if (f.indexRange !== null) count++;
        if (f.selectedAuthors.length > 0) count++;
        if (f.selectedMelodien.length > 0) count++;
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

    // Die Weisen des Bestands, nach Choralbuchnummer geordnet.
    //
    // Zusammengefasst wird über die Melodie-id, nicht über den Titel: dieselbe
    // Weise trägt bei jedem ihrer Lieder denselben Melodietitel, aber zwei
    // verschiedene Weisen dürfen gleich heißen.
    const melodien = computed((): Melodie[] => {
        const byId = new Map<string, Melodie>();

        for (const song of songs.value) {
            if (!song.melodieId) continue;
            const known = byId.get(song.melodieId);
            if (known) {
                known.count++;
                continue;
            }
            byId.set(song.melodieId, {
                id: song.melodieId,
                // Ohne eigenen Melodietitel bleibt der Liedtitel — bei einer nur
                // einmal verwendeten Weise ist das ohnehin derselbe Text.
                titel: song.melodieTitel?.trim() || song.titel,
                nummer: song.choralbuchNummer ?? null,
                count: 1,
            });
        }

        return Array.from(byId.values()).sort((a, b) => {
            // Ohne Nummer ans Ende — dort bleibt nur der Titel zum Sortieren.
            if (a.nummer == null || b.nummer == null) {
                if (a.nummer != null) return -1;
                if (b.nummer != null) return 1;
                return a.titel.localeCompare(b.titel, 'de');
            }
            return a.nummer - b.nummer;
        });
    });

    // Available Weisen from songs (for filter options). Die Choralbuchnummer
    // steht vorne, damit die Suche im Filter auch auf die reine Nummer anspringt.
    const availableMelodien = computed((): FilterOption[] =>
        melodien.value.map((m) => ({
            label: m.nummer == null ? m.titel : `${m.nummer} · ${m.titel}`,
            value: m.id,
            count: m.count,
        })),
    );

    // Die gefilterten Weisen, ausgeschrieben — `filters.selectedMelodien` hält
    // nur ids, die Chips in der Toolbar brauchen aber Nummer und Titel.
    const activeMelodien = computed((): Melodie[] =>
        melodien.value.filter((m) => filters.value.selectedMelodien.includes(m.id)),
    );

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

        // Search filter: jedes Wort der Eingabe muss irgendwo am Lied sitzen,
        // aber nicht alle im selben Feld — „luther 45" meint Lied 45 von Luther.
        const terms = activeSearchTerms.value;
        if (terms.length) {
            result = result.filter((song) => songMatchesTerms(song, terms));
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

        // Weise filter
        if (f.selectedMelodien.length > 0) {
            result = result.filter(
                (song) => !!song.melodieId && f.selectedMelodien.includes(song.melodieId),
            );
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

    function toggleMelodie(melodieId: string) {
        const idx = filters.value.selectedMelodien.indexOf(melodieId);
        if (idx >= 0) {
            filters.value.selectedMelodien.splice(idx, 1);
        } else {
            filters.value.selectedMelodien.push(melodieId);
        }
    }

    // Ersetzt die ganze Weisen-Auswahl — das Gegenstück zu setAuthors, für den
    // Deep Link aus der Lied-Ansicht („welche Lieder haben dieselbe Weise?").
    function setMelodien(melodieIds: string[]) {
        filters.value.selectedMelodien = [...melodieIds];
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
        activeSearchTerms,
        isSearchActive,
        hasActiveFilters,
        activeFilterCount,
        availableCategories,
        availableAuthors,
        availableMelodien,
        activeMelodien,
        indexRange,

        // Actions
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
    };
}
