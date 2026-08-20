<template>
    <ResponsivePanel
        :open="isOpen"
        :anchor="anchor"
        label="Filter"
        :snap-points="[0.5, 0.75, 1]"
        :initial-snap-point="0.75"
        drawer-class="h-full max-h-full"
        popover-class="w-96"
        @update:open="onOpenUpdate"
    >
        <!-- Panel header: pinned while the body scrolls underneath -->
        <div
            class="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 bg-popover px-4"
        >
            <PanelTitle>Filter</PanelTitle>
            <Button
                v-if="hasActiveFilters"
                variant="ghost"
                size="sm"
                class="-mr-2 text-primary"
                @click="$emit('clearAll')"
            >
                <RotateCcw aria-hidden="true" />
                Zurücksetzen
            </Button>
        </div>

        <!-- Categories -->
        <div class="px-4 pb-8 lg:pb-4">
            <!-- Section head + quick-search stay pinned (below the sheet header)
                 while the chip cloud scrolls -->
            <div class="cat-sticky sticky top-12 z-10 bg-popover pb-3 pt-1">
                <div class="mb-2 flex items-baseline justify-between gap-2">
                    <span class="label-micro text-gold">Kategorien</span>
                    <button
                        v-if="selectedCategories.length"
                        type="button"
                        class="shrink-0 text-xs text-primary"
                        @click="clearCategories"
                    >
                        {{ selectedCategories.length }} ausgewählt · zurücksetzen
                    </button>
                </div>

                <div class="flex cursor-text items-center gap-2 rounded-lg bg-muted px-3">
                    <Search class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        v-model="categoryQuery"
                        type="text"
                        class="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
                        placeholder="Kategorie suchen…"
                    />
                    <button
                        v-if="categoryQuery"
                        type="button"
                        class="inline-flex shrink-0 text-muted-foreground"
                        aria-label="Suche löschen"
                        @click="categoryQuery = ''"
                    >
                        <CircleX class="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div v-if="filteredCategories.length" class="flex flex-wrap gap-2">
                <button
                    v-for="category in filteredCategories"
                    :key="category.value"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm leading-tight transition-colors"
                    :class="
                        selectedCategories.includes(category.value)
                            ? 'border-primary/50 bg-accent font-medium text-accent-foreground'
                            : 'border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted'
                    "
                    :aria-pressed="selectedCategories.includes(category.value)"
                    @click="$emit('toggleCategory', category.value)"
                >
                    <span aria-hidden="true">{{ categoryEmoji(category.label) }}</span>
                    <span class="font-medium">{{ category.label }}</span>
                    <span
                        class="text-xs tabular-nums"
                        :class="
                            selectedCategories.includes(category.value)
                                ? 'text-accent-foreground/70'
                                : 'text-muted-foreground'
                        "
                    >
                        {{ category.count }}
                    </span>
                </button>
            </div>

            <p v-else class="py-6 text-center text-sm text-muted-foreground">
                {{
                    availableCategories.length
                        ? 'Keine Kategorie gefunden'
                        : 'Keine Kategorien verfügbar'
                }}
            </p>
        </div>

        <!-- Autoren -->
        <div class="border-t border-border px-4 pb-8 pt-4 lg:pb-4">
            <div class="mb-2 flex items-baseline justify-between gap-2">
                <span class="label-micro text-gold">Autoren</span>
                <button
                    v-if="selectedAuthors.length"
                    type="button"
                    class="shrink-0 text-xs text-primary"
                    @click="clearAuthors"
                >
                    {{ selectedAuthors.length }} ausgewählt · zurücksetzen
                </button>
            </div>

            <div class="mb-3 flex cursor-text items-center gap-2 rounded-lg bg-muted px-3">
                <Search class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                    v-model="authorQuery"
                    type="text"
                    class="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
                    placeholder="Autor suchen…"
                />
                <button
                    v-if="authorQuery"
                    type="button"
                    class="inline-flex shrink-0 text-muted-foreground"
                    aria-label="Suche löschen"
                    @click="authorQuery = ''"
                >
                    <CircleX class="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            <div v-if="visibleAuthors.length" class="flex flex-wrap gap-2">
                <button
                    v-for="author in visibleAuthors"
                    :key="author.value"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm leading-tight transition-colors"
                    :class="
                        selectedAuthors.includes(author.value)
                            ? 'border-primary/50 bg-accent font-medium text-accent-foreground'
                            : 'border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted'
                    "
                    :aria-pressed="selectedAuthors.includes(author.value)"
                    @click="$emit('toggleAuthor', author.value)"
                >
                    <User class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span class="font-medium">{{ author.label }}</span>
                    <span
                        class="text-xs tabular-nums"
                        :class="
                            selectedAuthors.includes(author.value)
                                ? 'text-accent-foreground/70'
                                : 'text-muted-foreground'
                        "
                    >
                        {{ author.count }}
                    </span>
                </button>
            </div>

            <p v-else class="py-6 text-center text-sm text-muted-foreground">
                {{ availableAuthors.length ? 'Kein Autor gefunden' : 'Keine Autoren verfügbar' }}
            </p>

            <Button
                v-if="hiddenAuthorCount > 0"
                variant="ghost"
                size="sm"
                class="mt-3 w-full text-primary"
                @click="showAllAuthors = true"
            >
                Alle {{ availableAuthors.length }} Autoren anzeigen
            </Button>
        </div>

        <!-- Liednummer -->
        <div class="border-t border-border px-4 pb-10 pt-4 lg:pb-5">
            <p class="label-micro mb-4 text-gold">Liednummer</p>

            <div class="space-y-3">
                <p class="text-sm text-muted-foreground">
                    Liedernummer:
                    <span class="number-display text-base">
                        {{ currentMin }} - {{ currentMax }}
                    </span>
                </p>
                <Slider
                    :model-value="[currentMin, currentMax]"
                    :min="indexRange.min"
                    :max="indexRange.max"
                    :step="1"
                    aria-label="Liedernummer"
                    @update:model-value="onRangeUpdate"
                />
                <Button
                    v-if="isRangeActive"
                    variant="ghost"
                    size="sm"
                    class="w-full text-primary"
                    @click="$emit('setIndexRange', null)"
                >
                    Bereich zurücksetzen
                </Button>
            </div>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { CircleX, RotateCcw, Search, User } from 'lucide-vue-next';

import type { FilterOption } from '@/composables/useSongFiltering';

import { Button } from '@/components/ui/button';
import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';
import { Slider } from '@/components/ui/slider';

import type { PanelAnchor } from '@/lib/anchor';
import { categoryEmoji } from '@/utils/categoryEmoji';

const props = defineProps<{
    isOpen: boolean;
    /** What the desktop popover opens against — the toolbar's filter button. */
    anchor?: PanelAnchor;
    availableCategories: FilterOption[];
    selectedCategories: string[];
    availableAuthors: FilterOption[];
    selectedAuthors: string[];
    filterIndexRange: { min: number; max: number } | null;
    indexRange: { min: number; max: number };
    hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'toggleCategory', category: string): void;
    (e: 'toggleAuthor', author: string): void;
    (e: 'setIndexRange', range: { min: number; max: number } | null): void;
    (e: 'clearAll'): void;
}>();

function onOpenUpdate(open: boolean) {
    if (!open) emit('close');
}

// Category quick-search — the main usability win with 60+ categories
const categoryQuery = ref('');

const filteredCategories = computed(() => {
    const query = categoryQuery.value.trim().toLowerCase();
    if (!query) return props.availableCategories;
    return props.availableCategories.filter((c) => c.label.toLowerCase().includes(query));
});

function clearCategories() {
    // Deselect every currently selected category (copy first — toggling mutates
    // the parent's array via the emitted events)
    [...props.selectedCategories].forEach((category) => emit('toggleCategory', category));
}

// Author quick-search. The hymnal names hundreds of authors, far too many to
// pour into the sheet at once — the list opens on the ones carrying the most
// songs, and the search box (or one tap on "alle") reaches the rest.
const authorQuery = ref('');
const showAllAuthors = ref(false);
const AUTHOR_PREVIEW_COUNT = 24;

const filteredAuthors = computed(() => {
    const query = authorQuery.value.trim().toLowerCase();
    if (!query) return props.availableAuthors;
    return props.availableAuthors.filter((a) => a.label.toLowerCase().includes(query));
});

const visibleAuthors = computed(() => {
    if (showAllAuthors.value || authorQuery.value.trim()) return filteredAuthors.value;

    const preview = [...filteredAuthors.value]
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, AUTHOR_PREVIEW_COUNT);

    // A selected author always stays in view, even outside the preview — a
    // filter you cannot see is a filter you cannot switch off.
    const selected = filteredAuthors.value.filter(
        (a) => props.selectedAuthors.includes(a.value) && !preview.includes(a),
    );
    return [...selected, ...preview];
});

const hiddenAuthorCount = computed(
    () => filteredAuthors.value.length - visibleAuthors.value.length,
);

function clearAuthors() {
    // Same reason as clearCategories: toggling mutates the parent's array
    [...props.selectedAuthors].forEach((author) => emit('toggleAuthor', author));
}

// Current range values
const currentMin = computed(() => props.filterIndexRange?.min ?? props.indexRange.min);
const currentMax = computed(() => props.filterIndexRange?.max ?? props.indexRange.max);

const isRangeActive = computed(() => props.filterIndexRange !== null);

function onRangeUpdate(value: number[] | undefined) {
    if (!value || value.length < 2) return;
    const [lower, upper] = value;
    // Only emit a range when it differs from the full range (a full-range
    // selection is a no-op and must not count as an active filter)
    if (lower !== props.indexRange.min || upper !== props.indexRange.max) {
        emit('setIndexRange', { min: lower, max: upper });
    } else {
        emit('setIndexRange', null);
    }
}
</script>
