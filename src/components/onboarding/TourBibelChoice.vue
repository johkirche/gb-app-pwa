<template>
    <div>
        <!-- Stacked cards, not the settings' segmented control: three options with
             a line each would not fit side by side at Größe 200 %. -->
        <RadioGroupRoot
            :model-value="choice"
            aria-label="Bibel"
            loop
            class="flex flex-col gap-2"
            @update:model-value="onChoice"
        >
            <RadioGroupItem
                v-for="option in OPTIONS"
                :key="option.value"
                :value="option.value"
                class="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-primary data-[state=checked]:bg-accent"
            >
                <!-- The portrait floats, so the text takes the whole width below it, and
                     at Größe 200 % a long word still has a line it fits on. Decorative:
                     the name is right beside it. The ground stays this cream in the dark
                     theme too, where the dark coats would otherwise sink into the card. -->
                <span class="flow-root">
                    <img
                        v-if="option.portrait"
                        :src="option.portrait"
                        alt=""
                        class="float-right mb-1 ml-3 size-14 rounded-full bg-[#ede5d8]"
                    />
                    <span class="block text-[0.9375rem] font-medium">{{ option.label }}</span>
                    <span class="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                        {{ option.note }}
                    </span>
                </span>
            </RadioGroupItem>
        </RadioGroupRoot>

        <Button
            type="button"
            variant="ghost"
            class="mt-1 h-auto min-h-10 w-full whitespace-normal py-2 text-muted-foreground"
            @click="comparing = true"
        >
            Übersetzungen vergleichen
        </Button>
        <BibelCompareDialog v-model:open="comparing" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { type AcceptableValue, RadioGroupItem, RadioGroupRoot } from 'reka-ui';

import lutherPortrait from '@/assets/bibel/portrait-luther.svg';
import mengePortrait from '@/assets/bibel/portrait-menge.svg';

import { usePreferencesStore } from '@/stores/preferences';

import BibelCompareDialog from '@/components/onboarding/BibelCompareDialog.vue';
import { Button } from '@/components/ui/button';

import { BIBEL_TRANSLATIONS } from '@/utils/bibel';

const preferencesStore = usePreferencesStore();

const comparing = ref(false);

const OPTIONS = [
    { value: 'none', label: 'Ohne Bibel', note: 'Nur das Gesangbuch.', portrait: null },
    {
        value: 'luther1912',
        label: 'Luther (1912)',
        note: BIBEL_TRANSLATIONS.luther1912.note,
        portrait: lutherPortrait,
    },
    {
        value: 'menge',
        label: 'Menge (1939)',
        note: BIBEL_TRANSLATIONS.menge.note,
        portrait: mengePortrait,
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
