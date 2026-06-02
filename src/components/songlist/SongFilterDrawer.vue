<template>
    <ion-modal
        :is-open="isOpen"
        :initial-breakpoint="0.75"
        :breakpoints="[0, 0.5, 0.75, 1]"
        :handle="true"
        @didDismiss="$emit('close')"
    >
        <ion-header>
            <ion-toolbar>
                <ion-title>Filter</ion-title>
                <ion-buttons slot="end">
                    <ion-button v-if="hasActiveFilters" fill="clear" @click="$emit('clearAll')">
                        <ion-icon slot="start" :icon="refreshOutline" />
                        Zurücksetzen
                    </ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>

        <ion-content class="filter-content">
            <!-- Categories -->
            <div class="filter-section">
                <div class="cat-sticky">
                    <div class="section-head">
                        <span class="section-label">Kategorien</span>
                        <button
                            v-if="selectedCategories.length"
                            type="button"
                            class="section-clear"
                            @click="clearCategories"
                        >
                            {{ selectedCategories.length }} ausgewählt · zurücksetzen
                        </button>
                    </div>

                    <div class="cat-search">
                        <ion-icon :icon="searchOutline" class="cat-search__icon" />
                        <input
                            v-model="categoryQuery"
                            type="text"
                            class="cat-search__input"
                            placeholder="Kategorie suchen…"
                        />
                        <button
                            v-if="categoryQuery"
                            type="button"
                            class="cat-search__clear"
                            aria-label="Suche löschen"
                            @click="categoryQuery = ''"
                        >
                            <ion-icon :icon="closeCircle" />
                        </button>
                    </div>
                </div>

                <div v-if="filteredCategories.length" class="cat-chips">
                    <button
                        v-for="category in filteredCategories"
                        :key="category.value"
                        type="button"
                        class="cat-chip"
                        :class="{ 'cat-chip--selected': selectedCategories.includes(category.value) }"
                        :aria-pressed="selectedCategories.includes(category.value)"
                        @click="$emit('toggleCategory', category.value)"
                    >
                        <span class="cat-chip__emoji" aria-hidden="true">
                            {{ categoryEmoji(category.label) }}
                        </span>
                        <span class="cat-chip__label">{{ category.label }}</span>
                        <span class="cat-chip__count">{{ category.count }}</span>
                    </button>
                </div>

                <div v-else class="cat-empty">
                    <ion-text color="medium">
                        {{
                            availableCategories.length
                                ? 'Keine Kategorie gefunden'
                                : 'Keine Kategorien verfügbar'
                        }}
                    </ion-text>
                </div>
            </div>

            <!-- Dev Filters (may be removed later) -->
            <div class="filter-section dev-section">
                <ion-label class="section-label">Dev Filter</ion-label>

                <div class="filter-row">
                    <ion-label class="filter-label">Hat Noten (PDF)</ion-label>
                    <ion-segment :value="hasNotesValue" @ionChange="onHasNotesChange($event)">
                        <ion-segment-button value="all">
                            <ion-label>Alle</ion-label>
                        </ion-segment-button>
                        <ion-segment-button value="yes">
                            <ion-label>Ja</ion-label>
                        </ion-segment-button>
                        <ion-segment-button value="no">
                            <ion-label>Nein</ion-label>
                        </ion-segment-button>
                    </ion-segment>
                </div>

                <div class="filter-row">
                    <ion-label class="filter-label">Hat MusicXML</ion-label>
                    <ion-segment
                        :value="hasMelodyXmlValue"
                        @ionChange="onHasMelodyXmlChange($event)"
                    >
                        <ion-segment-button value="all">
                            <ion-label>Alle</ion-label>
                        </ion-segment-button>
                        <ion-segment-button value="yes">
                            <ion-label>Ja</ion-label>
                        </ion-segment-button>
                        <ion-segment-button value="no">
                            <ion-label>Nein</ion-label>
                        </ion-segment-button>
                    </ion-segment>
                </div>

                <div class="filter-row">
                    <ion-label class="filter-label">
                        Liedernummer: {{ currentMin }} - {{ currentMax }}
                    </ion-label>
                    <ion-range
                        :dual-knobs="true"
                        :min="indexRange.min"
                        :max="indexRange.max"
                        :value="{ lower: currentMin, upper: currentMax }"
                        :pin="true"
                        :snaps="false"
                        @ionChange="onRangeChange($event)"
                    />
                    <ion-button
                        v-if="isRangeActive"
                        fill="clear"
                        size="small"
                        expand="block"
                        @click="$emit('setIndexRange', null)"
                    >
                        Bereich zurücksetzen
                    </ion-button>
                </div>
            </div>
        </ion-content>
    </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonLabel,
    IonModal,
    IonRange,
    IonSegment,
    IonSegmentButton,
    IonText,
    IonTitle,
    IonToolbar,
} from '@ionic/vue';
import { closeCircle, refreshOutline, searchOutline } from 'ionicons/icons';

import { categoryEmoji } from '@/utils/categoryEmoji';

import type { FilterOption } from '@/composables/useSongFiltering';

const props = defineProps<{
    isOpen: boolean;
    availableCategories: FilterOption[];
    selectedCategories: string[];
    hasNotes: boolean | null;
    hasMelodyXml: boolean | null;
    filterIndexRange: { min: number; max: number } | null;
    indexRange: { min: number; max: number };
    hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'toggleCategory', category: string): void;
    (e: 'setHasNotes', value: boolean | null): void;
    (e: 'setHasMelodyXml', value: boolean | null): void;
    (e: 'setIndexRange', range: { min: number; max: number } | null): void;
    (e: 'clearAll'): void;
}>();

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

// Convert boolean | null to segment value
const hasNotesValue = computed(() => {
    if (props.hasNotes === true) return 'yes';
    if (props.hasNotes === false) return 'no';
    return 'all';
});

const hasMelodyXmlValue = computed(() => {
    if (props.hasMelodyXml === true) return 'yes';
    if (props.hasMelodyXml === false) return 'no';
    return 'all';
});

// Current range values
const currentMin = computed(() => props.filterIndexRange?.min ?? props.indexRange.min);
const currentMax = computed(() => props.filterIndexRange?.max ?? props.indexRange.max);

const isRangeActive = computed(() => props.filterIndexRange !== null);

function onHasNotesChange(event: CustomEvent) {
    const value = event.detail.value;
    if (value === 'yes') emit('setHasNotes', true);
    else if (value === 'no') emit('setHasNotes', false);
    else emit('setHasNotes', null);
}

function onHasMelodyXmlChange(event: CustomEvent) {
    const value = event.detail.value;
    if (value === 'yes') emit('setHasMelodyXml', true);
    else if (value === 'no') emit('setHasMelodyXml', false);
    else emit('setHasMelodyXml', null);
}

function onRangeChange(event: CustomEvent) {
    const { lower, upper } = event.detail.value;
    // Only emit if actually different from full range
    if (lower !== props.indexRange.min || upper !== props.indexRange.max) {
        emit('setIndexRange', { min: lower, max: upper });
    } else {
        emit('setIndexRange', null);
    }
}
</script>

<style scoped>
.filter-content {
    --padding-start: 0;
    --padding-end: 0;
}

.filter-section {
    padding: 0 var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
}

.section-label {
    display: block;
    font-weight: 600;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ion-color-medium);
}

/* Category search + heading stay pinned while the chip cloud scrolls */
.cat-sticky {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--ion-background-color);
    padding: var(--spacing-md) 0 var(--spacing-sm);
}

.section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
}

.section-clear {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    font-size: var(--font-size-xs);
    color: var(--ion-color-primary);
    cursor: pointer;
}

.cat-search {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: var(--ion-color-light);
    border-radius: var(--radius-md);
    padding: 0 var(--spacing-md);
}

.cat-search__icon {
    flex-shrink: 0;
    font-size: 1.125rem;
    color: var(--ion-color-medium);
}

.cat-search__input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    outline: none;
    padding: var(--spacing-sm) 0;
    font-size: var(--font-size-base);
    color: var(--ion-text-color);
}

.cat-search__input::placeholder {
    color: var(--ion-color-medium);
}

.cat-search__clear {
    display: inline-flex;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--ion-color-medium);
    font-size: 1.125rem;
}

/* Chip cloud */
.cat-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
}

.cat-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--ion-color-light-shade);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font-size: var(--font-size-sm);
    line-height: 1.2;
    cursor: pointer;
    transition:
        background 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;
}

.cat-chip__emoji {
    font-size: 1rem;
    line-height: 1;
}

.cat-chip__label {
    font-weight: 500;
}

.cat-chip__count {
    font-size: var(--font-size-xs);
    color: var(--ion-color-medium);
    font-variant-numeric: tabular-nums;
}

.cat-chip--selected {
    border-color: var(--ion-color-primary);
    background: rgba(var(--ion-color-primary-rgb), 0.12);
    color: var(--ion-color-primary);
}

.cat-chip--selected .cat-chip__count {
    color: var(--ion-color-primary);
}

@media (hover: hover) and (pointer: fine) {
    .cat-chip:hover {
        border-color: var(--ion-color-primary);
        background: var(--ion-color-light);
    }

    .cat-chip--selected:hover {
        background: rgba(var(--ion-color-primary-rgb), 0.2);
    }
}

.cat-empty {
    padding: var(--spacing-lg) 0;
    text-align: center;
}

/* Dev filters */
.dev-section {
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--ion-color-light-shade);
}

.dev-section .section-label {
    margin-bottom: var(--spacing-md);
}

.filter-row {
    margin-bottom: var(--spacing-md);
}

.filter-label {
    display: block;
    font-size: var(--font-size-sm);
    color: var(--ion-color-medium);
    margin-bottom: var(--spacing-sm);
}

.filter-row ion-segment {
    width: 100%;
}

.filter-row ion-range {
    padding: 0;
}
</style>
