<template>
    <ResponsivePanel
        :open="isOpen"
        :anchor="anchor"
        label="Filter"
        popover-class="w-96"
        @update:open="onOpenUpdate"
    >
        <div class="flex min-h-0 flex-1 flex-col">
            <!-- One header for every level: it renames itself and grows a back
                 button rather than sliding away with the panes underneath. -->
            <div class="flex h-12 shrink-0 items-center gap-1 px-2 pr-4">
                <Button
                    v-if="view !== 'root'"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zurück zur Filterübersicht"
                    @click="goBack"
                >
                    <ChevronLeft aria-hidden="true" />
                </Button>

                <PanelTitle :class="view === 'root' ? 'px-2' : undefined">
                    {{ activeSection?.title ?? 'Filter' }}
                </PanelTitle>

                <div class="flex-1" />

                <Button
                    v-if="canResetHere"
                    variant="ghost"
                    size="sm"
                    class="-mr-2 shrink-0 text-primary"
                    @click="resetHere"
                >
                    <RotateCcw aria-hidden="true" />
                    Zurücksetzen
                </Button>
            </div>

            <!-- The levels are stacked in one grid cell, so the outgoing pane
                 slides out under the incoming one instead of the panel
                 collapsing to nothing between them. -->
            <div class="grid min-h-[13rem] flex-1 overflow-hidden">
                <Transition :name="transition">
                    <div
                        :key="view"
                        class="col-start-1 row-start-1 flex min-h-0 flex-col"
                        :class="view === 'root' ? undefined : 'overflow-hidden'"
                    >
                        <!-- Level 1: what can be filtered, and what is set -->
                        <div v-if="view === 'root'" class="divide-y divide-border pb-2">
                            <button
                                v-for="section in sections"
                                :key="section.key"
                                type="button"
                                class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted"
                                @click="view = section.key"
                            >
                                <span
                                    class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                                    :class="
                                        section.count
                                            ? 'bg-primary/15 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                    "
                                >
                                    <component
                                        :is="section.icon"
                                        class="size-4"
                                        aria-hidden="true"
                                    />
                                </span>

                                <span class="min-w-0 flex-1">
                                    <span class="block text-[15px] font-medium text-foreground">
                                        {{ section.title }}
                                    </span>
                                    <span
                                        class="block truncate text-[13px]"
                                        :class="
                                            section.count
                                                ? 'text-foreground/70'
                                                : 'text-muted-foreground'
                                        "
                                    >
                                        {{ section.summary }}
                                    </span>
                                </span>

                                <span
                                    v-if="section.badge"
                                    class="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary"
                                >
                                    {{ section.badge }}
                                </span>

                                <ChevronRight
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            </button>
                        </div>

                        <!-- Level 2: one facet at a time, with the whole panel to itself -->
                        <FilterOptionList
                            v-else-if="view === 'categories'"
                            :options="availableCategories"
                            :selected="selectedCategories"
                            search-placeholder="Kategorie suchen…"
                            no-match-label="Keine Kategorie gefunden"
                            empty-label="Keine Kategorien verfügbar"
                            @toggle="$emit('toggleCategory', $event)"
                        >
                            <template #glyph="{ option }">
                                <span class="shrink-0 text-base leading-none" aria-hidden="true">
                                    {{ categoryEmoji(option.label) }}
                                </span>
                            </template>
                        </FilterOptionList>

                        <FilterOptionList
                            v-else-if="view === 'authors'"
                            :options="availableAuthors"
                            :selected="selectedAuthors"
                            search-placeholder="Autor suchen…"
                            no-match-label="Kein Autor gefunden"
                            empty-label="Keine Autoren verfügbar"
                            @toggle="$emit('toggleAuthor', $event)"
                        >
                            <template #glyph>
                                <User
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            </template>
                        </FilterOptionList>

                        <!-- Die Weise: beschriftet mit ihrer Choralbuchnummer,
                             sodass die Suche hier auch auf die reine Nummer
                             anspringt. -->
                        <FilterOptionList
                            v-else-if="view === 'melodien'"
                            :options="availableMelodien"
                            :selected="selectedMelodien"
                            search-placeholder="Weise oder Choralbuchnummer suchen…"
                            no-match-label="Keine Weise gefunden"
                            empty-label="Keine Weisen verfügbar"
                            @toggle="$emit('toggleMelodie', $event)"
                        >
                            <template #glyph>
                                <Music2
                                    class="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            </template>
                        </FilterOptionList>

                        <!-- One control, so it sits centred in the pane rather
                             than clinging to the top of an empty box -->
                        <div v-else class="flex flex-1 flex-col justify-center gap-5 px-4 pb-4">
                            <p class="number-display text-center text-2xl">
                                {{ currentMin }} – {{ currentMax }}
                            </p>
                            <div class="space-y-1.5">
                                <Slider
                                    :model-value="[currentMin, currentMax]"
                                    :min="indexRange.min"
                                    :max="indexRange.max"
                                    :step="1"
                                    aria-label="Liedernummer"
                                    @update:model-value="onRangeUpdate"
                                />
                                <div
                                    class="flex justify-between text-xs tabular-nums text-muted-foreground"
                                >
                                    <span>{{ indexRange.min }}</span>
                                    <span>{{ indexRange.max }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { type FunctionalComponent, computed, ref, watch } from 'vue';

import { ChevronLeft, ChevronRight, Hash, Music2, RotateCcw, Tag, User } from 'lucide-vue-next';

import type { FilterOption } from '@/composables/useSongFiltering';

import FilterOptionList from '@/components/songlist/FilterOptionList.vue';
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
    availableMelodien: FilterOption[];
    selectedMelodien: string[];
    filterIndexRange: { min: number; max: number } | null;
    indexRange: { min: number; max: number };
    hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'toggleCategory', category: string): void;
    (e: 'toggleAuthor', author: string): void;
    (e: 'toggleMelodie', melodieId: string): void;
    (e: 'setIndexRange', range: { min: number; max: number } | null): void;
    (e: 'clearAll'): void;
}>();

function onOpenUpdate(open: boolean) {
    if (!open) emit('close');
}

type View = 'root' | 'categories' | 'authors' | 'melodien' | 'index';

const view = ref<View>('root');
const transition = ref<'pane-forward' | 'pane-back'>('pane-forward');

// Reopen on the overview. Resetting on close instead would swap the pane out
// while the sheet is still animating away.
watch(
    () => props.isOpen,
    (open) => {
        if (open) {
            view.value = 'root';
            transition.value = 'pane-forward';
        }
    },
);

watch(view, (next, previous) => {
    transition.value = next === 'root' && previous !== 'root' ? 'pane-back' : 'pane-forward';
});

function goBack() {
    view.value = 'root';
}

// Current range values
const currentMin = computed(() => props.filterIndexRange?.min ?? props.indexRange.min);
const currentMax = computed(() => props.filterIndexRange?.max ?? props.indexRange.max);

const isRangeActive = computed(() => props.filterIndexRange !== null);

// Die Weisen-Auswahl steht als Melodie-id im Filter — in der Übersicht muss sie
// lesbar sein, also zurück auf die Beschriftung aus der Optionsliste.
const selectedMelodienLabels = computed(() =>
    props.selectedMelodien.map(
        (id) => props.availableMelodien.find((option) => option.value === id)?.label ?? id,
    ),
);

interface Section {
    key: Exclude<View, 'root'>;
    title: string;
    icon: FunctionalComponent;
    /** What is set right now, spelled out under the section name. */
    summary: string;
    /** Whether the section carries a filter — tints the row and its icon. */
    count: number;
    /** Only a countable set earns a number; a range says so in its summary. */
    badge?: number;
    clear: () => void;
}

const sections = computed((): Section[] => [
    {
        key: 'categories',
        title: 'Kategorien',
        icon: Tag,
        summary: props.selectedCategories.length ? props.selectedCategories.join(', ') : 'Alle',
        count: props.selectedCategories.length,
        badge: props.selectedCategories.length || undefined,
        clear: clearCategories,
    },
    {
        key: 'authors',
        title: 'Autoren',
        icon: User,
        summary: props.selectedAuthors.length ? props.selectedAuthors.join(', ') : 'Alle',
        count: props.selectedAuthors.length,
        badge: props.selectedAuthors.length || undefined,
        clear: clearAuthors,
    },
    {
        key: 'melodien',
        title: 'Weisen',
        icon: Music2,
        summary: selectedMelodienLabels.value.length
            ? selectedMelodienLabels.value.join(', ')
            : 'Alle',
        count: props.selectedMelodien.length,
        badge: props.selectedMelodien.length || undefined,
        clear: clearMelodien,
    },
    {
        key: 'index',
        title: 'Liednummer',
        icon: Hash,
        summary: isRangeActive.value ? `${currentMin.value} – ${currentMax.value}` : 'Alle',
        count: isRangeActive.value ? 1 : 0,
        clear: () => emit('setIndexRange', null),
    },
]);

const activeSection = computed(() => sections.value.find((s) => s.key === view.value));

// On the overview the reset button clears everything; inside a facet it clears
// only that facet — the one the reader is looking at.
const canResetHere = computed(() =>
    view.value === 'root' ? props.hasActiveFilters : (activeSection.value?.count ?? 0) > 0,
);

function resetHere() {
    if (view.value === 'root') {
        emit('clearAll');
    } else {
        activeSection.value?.clear();
    }
}

function clearCategories() {
    // Deselect every currently selected category (copy first — toggling mutates
    // the parent's array via the emitted events)
    [...props.selectedCategories].forEach((category) => emit('toggleCategory', category));
}

function clearAuthors() {
    // Same reason as clearCategories: toggling mutates the parent's array
    [...props.selectedAuthors].forEach((author) => emit('toggleAuthor', author));
}

function clearMelodien() {
    // Same reason as clearCategories: toggling mutates the parent's array
    [...props.selectedMelodien].forEach((melodieId) => emit('toggleMelodie', melodieId));
}

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

<style scoped>
.pane-forward-enter-active,
.pane-forward-leave-active,
.pane-back-enter-active,
.pane-back-leave-active {
    transition:
        transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
        opacity 140ms ease;
}

.pane-forward-enter-from,
.pane-back-leave-to {
    opacity: 0;
    transform: translateX(100%);
}

.pane-forward-leave-to,
.pane-back-enter-from {
    opacity: 0;
    transform: translateX(-25%);
}

@media (prefers-reduced-motion: reduce) {
    .pane-forward-enter-active,
    .pane-forward-leave-active,
    .pane-back-enter-active,
    .pane-back-leave-active {
        transition: opacity 100ms ease;
    }

    .pane-forward-enter-from,
    .pane-forward-leave-to,
    .pane-back-enter-from,
    .pane-back-leave-to {
        transform: none;
    }
}
</style>
