<template>
    <SettingsList>
        <!-- Off by default: a hymnal first. The Bible is a tab for whoever
             wants it to hand, not a fixture for everyone. -->
        <div class="flex items-center justify-between gap-4 px-2 py-3">
            <div class="flex min-w-0 items-center gap-4">
                <BookOpen class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0">
                    <Label for="settings-bibel" class="text-[15px] font-normal">Bibel-Reiter</Label>
                    <p class="text-sm text-muted-foreground">
                        Die Bibel als eigener Reiter, zum Lesen und Blättern
                    </p>
                </div>
            </div>
            <Switch
                id="settings-bibel"
                :model-value="preferencesStore.showBibel"
                @update:model-value="preferencesStore.setShowBibel($event)"
            />
        </div>

        <!-- Off by default: the references were assigned by a language model
             and checked by script, not chosen by an editor — the description
             says so, so nobody takes them for the book's own. Independent of
             the tab: the passages under a song need no Bible to read in. -->
        <div class="flex items-center justify-between gap-4 px-2 py-3">
            <div class="flex min-w-0 items-center gap-4">
                <BookMarked class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0">
                    <Label for="settings-bibelstellen" class="text-[15px] font-normal">
                        Bibelstellen unter Liedern
                    </Label>
                    <p class="text-sm text-muted-foreground">
                        Die Stellen, auf die ein Lied anspielt. Automatisch zugeordnet, nicht
                        redaktionell geprüft
                    </p>
                    <!-- The passages come with the sync, where the hymnal offers
                         them at all: said so, rather than a switch that seems
                         to do nothing. -->
                    <p v-if="!bibelstellen" class="mt-1 text-sm text-muted-foreground">
                        Für dieses Gesangbuch sind noch keine Bibelstellen hinterlegt.
                    </p>
                </div>
            </div>
            <Switch
                id="settings-bibelstellen"
                :model-value="preferencesStore.showBibelstellen"
                @update:model-value="preferencesStore.setShowBibelstellen($event)"
            />
        </div>

        <template v-if="preferencesStore.showBibel">
            <!-- One translation or the other: the whole reader follows, and so
                 do the search and the offline download. -->
            <div class="px-2 py-3">
                <div class="flex items-center gap-4">
                    <Languages class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p class="text-[15px]">Übersetzung</p>
                </div>
                <ToggleGroup
                    type="single"
                    class="mt-3 flex w-full"
                    aria-label="Übersetzung"
                    :model-value="preferencesStore.bibelTranslation"
                    @update:model-value="onTranslation"
                >
                    <ToggleGroupItem value="menge" class="flex-1">Menge (1939)</ToggleGroupItem>
                    <ToggleGroupItem value="luther1912" class="flex-1">
                        Luther (1912)
                    </ToggleGroupItem>
                </ToggleGroup>
                <p class="mt-2 text-sm text-muted-foreground">
                    {{ translationNote }}
                </p>
            </div>

            <!-- The Bible's own size. Until it is moved it follows Größe
                 (Lieder) under Darstellung, so the percentage shown is that one. -->
            <div class="px-2 py-3">
                <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <Type class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <p class="text-[15px]">Textgröße</p>
                    </div>
                    <span class="number-display text-lg leading-none">
                        {{ Math.round(preferencesStore.bibelScale * 100) }}%
                    </span>
                </div>
                <div class="mt-4 flex items-center gap-3">
                    <span class="shrink-0 text-xs text-muted-foreground">50%</span>
                    <Slider
                        v-model="bibelScaleSlider"
                        :min="0.5"
                        :max="2"
                        :step="0.1"
                        aria-label="Textgröße (Bibel)"
                        class="flex-1"
                    />
                    <span class="shrink-0 text-xs text-muted-foreground">200%</span>
                </div>
            </div>

            <!-- The features, each with a sample and how to reach it, on a page
                 of their own: listed here they buried the few settings above. -->
            <button
                type="button"
                class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                @click="openFeatures"
            >
                <SlidersHorizontal
                    class="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                    <p class="text-[15px]">Funktionen</p>
                    <p class="text-sm text-muted-foreground">
                        Lesezeichen, Markierungen, Vorlesen … ·
                        {{ bibelFeatureSummary(preferencesStore.bibelFeatures) }}
                    </p>
                </div>
                <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>

            <p class="label-micro px-2 pb-1 pt-4 text-gold">Offline</p>
            <BibelOfflineStatus />
        </template>
    </SettingsList>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    BookMarked,
    BookOpen,
    ChevronRight,
    Languages,
    SlidersHorizontal,
    Type,
} from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { useRoute, useRouter } from 'vue-router';

import { usePreferencesStore } from '@/stores/preferences';

import BibelOfflineStatus from '@/components/bibel/BibelOfflineStatus.vue';
import SettingsList from '@/components/settings/SettingsList.vue';
import { bibelFeatureSummary } from '@/components/settings/bibelFeatures';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { bibelstellen, loadBibelstellen } from '@/utils/bibelstellen';

const preferencesStore = usePreferencesStore();
const route = useRoute();
const router = useRouter();

// One level deeper, as a step the back gesture undoes (see SettingsPage).
function openFeatures() {
    router.push({ query: { ...route.query, unter: 'funktionen' } });
}

loadBibelstellen().catch((err: unknown) => console.error('Error loading Bibelstellen:', err));

const translationNote = computed(() =>
    preferencesStore.bibelTranslation === 'menge'
        ? 'Hermann Menge, 1939. Mit Zwischenüberschriften und Anmerkungen.'
        : 'Martin Luther, Fassung von 1912, in neuer Rechtschreibung. Ohne Zwischenüberschriften.',
);

function onTranslation(value: AcceptableValue | AcceptableValue[]) {
    if (value === 'menge' || value === 'luther1912') {
        preferencesStore.setBibelTranslation(value);
    }
}

// Reka's Slider works on number[] (multi-thumb capable) — bridge to the scalar store value.
const bibelScaleSlider = computed<number[] | undefined>({
    get: () => [preferencesStore.bibelScale],
    set: (value) => {
        const scale = value?.[0];
        if (typeof scale === 'number') {
            preferencesStore.setBibelScale(scale);
        }
    },
});
</script>
