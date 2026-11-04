<template>
    <!-- Stacked cards, not the settings' segmented control: three options with
         a line each would not fit side by side at Größe 200 %. -->
    <RadioGroupRoot
        :model-value="choice"
        aria-label="Bibel"
        loop
        class="flex flex-col gap-3"
        @update:model-value="onChoice"
    >
        <RadioGroupItem
            v-for="option in OPTIONS"
            :key="option.value"
            :value="option.value"
            class="w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-primary data-[state=checked]:bg-accent"
        >
            <span class="block text-[0.9375rem] font-medium">{{ option.label }}</span>
            <span class="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                {{ option.note }}
            </span>
        </RadioGroupItem>
    </RadioGroupRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { type AcceptableValue, RadioGroupItem, RadioGroupRoot } from 'reka-ui';

import { usePreferencesStore } from '@/stores/preferences';

const preferencesStore = usePreferencesStore();

/** The notes are the Einstellungen's own, so a reader finds the same words there. */
const OPTIONS = [
    { value: 'none', label: 'Ohne Bibel', note: 'Nur das Gesangbuch.' },
    {
        value: 'menge',
        label: 'Menge (1939)',
        note: 'Hermann Menge, 1939. Mit Zwischenüberschriften und Anmerkungen.',
    },
    {
        value: 'luther1912',
        label: 'Luther (1912)',
        note: 'Martin Luther, Fassung von 1912, in neuer Rechtschreibung. Ohne Zwischenüberschriften.',
    },
] as const;

const choice = computed(() =>
    preferencesStore.showBibel ? preferencesStore.bibelTranslation : 'none',
);

// Saved as it is chosen, like the switches in the Einstellungen it stands for:
// a reader who leaves the onboarding here has still chosen.
function onChoice(value: AcceptableValue) {
    if (value === 'menge' || value === 'luther1912') {
        void preferencesStore.setBibelTranslation(value);
        void preferencesStore.setShowBibel(true);
    } else if (value === 'none') {
        void preferencesStore.setShowBibel(false);
    }
}
</script>
