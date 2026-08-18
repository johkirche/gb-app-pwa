<template>
    <Drawer
        :open="isOpen"
        :snap-points="[0.5, 0.75, 1]"
        :active-snap-point="activeSnapPoint"
        @update:active-snap-point="activeSnapPoint = $event"
        @update:open="onOpenUpdate"
    >
        <DrawerContent class="h-full max-h-full">
            <!-- Sheet header: pinned while the body scrolls underneath -->
            <div
                class="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 bg-popover px-4"
            >
                <DrawerTitle>Filter</DrawerTitle>
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
            <div class="px-4 pb-8">
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

                    <div class="flex items-center gap-2 rounded-lg bg-muted px-3">
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

            <!-- Liednummer -->
            <div class="border-t border-border px-4 pb-10 pt-4">
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
        </DrawerContent>
    </Drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { CircleX, RotateCcw, Search } from 'lucide-vue-next';

import type { FilterOption } from '@/composables/useSongFiltering';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Slider } from '@/components/ui/slider';

import { categoryEmoji } from '@/utils/categoryEmoji';

const props = defineProps<{
    isOpen: boolean;
    availableCategories: FilterOption[];
    selectedCategories: string[];
    filterIndexRange: { min: number; max: number } | null;
    indexRange: { min: number; max: number };
    hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'toggleCategory', category: string): void;
    (e: 'setIndexRange', range: { min: number; max: number } | null): void;
    (e: 'clearAll'): void;
}>();

// Sheet snap points mirror the old ion-modal breakpoints ([0, 0.5, 0.75, 1],
// initial 0.75; drag below the lowest snap point dismisses).
const activeSnapPoint = ref<number | string | null>(0.75);

watch(
    () => props.isOpen,
    (open) => {
        if (open) activeSnapPoint.value = 0.75;
    },
);

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
