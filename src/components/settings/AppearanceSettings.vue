<template>
    <SettingsList>
        <div class="px-2 py-3">
            <div class="flex items-center gap-4">
                <Contrast class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p class="text-[15px]">Farbschema</p>
            </div>
            <ToggleGroup
                type="single"
                class="mt-3 flex w-full"
                aria-label="Farbschema"
                :model-value="theme"
                @update:model-value="onThemeModeChange"
            >
                <ToggleGroupItem value="system" class="flex-1">System</ToggleGroupItem>
                <ToggleGroupItem value="light" class="flex-1">Hell</ToggleGroupItem>
                <ToggleGroupItem value="dark" class="flex-1">Dunkel</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <!-- Shown once it has been chosen, and not before. The choice is only
             ever met by enlarging a song past the width the page can show it
             at, and a setting that can only be found again by zooming back in
             to look for it is a setting that is lost. Until then the default
             holds and there is nothing here to say.

             Two cards rather than two words: „Notenbild behalten" and „Zeilen
             neu umbrechen" name a difference that is far easier to see. -->
        <fieldset
            v-if="beyondFitChosen"
            class="min-w-0 px-2 py-3"
            aria-labelledby="settings-beyond-fit-label"
        >
            <div class="flex items-center gap-4">
                <Image class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0">
                    <p id="settings-beyond-fit-label" class="text-[15px]">Stark vergrößert</p>
                    <p class="text-sm text-muted-foreground">
                        Was aus den Noten wird, wenn sie breiter sind als die Seite
                    </p>
                </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-3">
                <label
                    v-for="option in BEYOND_FIT_MODES"
                    :key="option.value"
                    class="flex cursor-pointer flex-col rounded-lg border border-border p-3 transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                    <input
                        v-model="beyondFit"
                        type="radio"
                        name="settings-beyond-fit"
                        :value="option.value"
                        class="sr-only"
                    />
                    <SongBeyondFitPreview :mode="option.value" />
                    <span class="mt-2.5 text-[15px] font-medium">{{ option.title }}</span>
                    <span class="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {{ option.description }}
                    </span>
                </label>
            </div>
        </fieldset>

        <!-- One size for the song page: notation and verses alike. They are set
             at the same size in the book, so two controls could only pull them
             apart. The sample under the slider is that page in miniature — a
             percentage on its own says nothing about how big the type gets. -->
        <div class="px-2 py-3">
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <Type class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <p class="text-[15px]">Größe (Lieder)</p>
                </div>
                <span class="number-display text-lg leading-none">
                    {{ Math.round(pageScale * 100) }}%
                </span>
            </div>
            <div class="mt-4 flex items-center gap-3">
                <span class="shrink-0 text-xs text-muted-foreground">50%</span>
                <Slider
                    v-model="pageScaleSlider"
                    :min="0.5"
                    :max="2"
                    :step="0.1"
                    aria-label="Größe (Lieder)"
                    class="flex-1"
                />
                <span class="shrink-0 text-xs text-muted-foreground">200%</span>
            </div>

            <!-- The sample sits under the slider, not over it: it grows with
                 the setting, and a preview that pushes its own control off the
                 screen is no use to the hand dragging it. -->
            <div class="mt-4 rounded-md border border-border bg-muted/40 px-3 py-3">
                <SongScalePreview :scale="pageScale" />
            </div>
        </div>

        <!-- Left out entirely where the platform has no Screen Wake Lock API:
             a switch that provably does nothing is worse than no switch. -->
        <div v-if="wakeLockSupported" class="flex items-center justify-between gap-4 px-2 py-3">
            <div class="flex min-w-0 items-center gap-4">
                <Lightbulb class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div class="min-w-0">
                    <Label for="settings-keep-awake" class="text-[15px] font-normal">
                        Bildschirm anlassen
                    </Label>
                    <p class="text-sm text-muted-foreground">
                        Die Liedseite bleibt hell, solange sie offen ist
                    </p>
                </div>
            </div>
            <Switch
                id="settings-keep-awake"
                :model-value="keepScreenAwake"
                @update:model-value="preferencesStore.setKeepScreenAwake($event)"
            />
        </div>
    </SettingsList>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Contrast, Image, Lightbulb, Type } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';

import { usePreferencesStore } from '@/stores/preferences';

import { useTheme } from '@/composables/useTheme';
import { isWakeLockSupported } from '@/composables/useWakeLock';

import SettingsList from '@/components/settings/SettingsList.vue';
import SongBeyondFitPreview from '@/components/songview/SongBeyondFitPreview.vue';
import SongScalePreview from '@/components/songview/SongScalePreview.vue';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { NotationBeyondFit } from '@/db';

const BEYOND_FIT_MODES: ReadonlyArray<{
    value: NotationBeyondFit;
    title: string;
    description: string;
}> = [
    {
        value: 'reflow',
        title: 'Zeilen neu umbrechen',
        description: 'Neu gesetzt, dafür ganz auf dem Bildschirm.',
    },
    {
        value: 'engraving',
        title: 'Notenbild behalten',
        description: 'Der Satz aus dem Buch, seitlich verschiebbar.',
    },
];

const preferencesStore = usePreferencesStore();
// useTheme owns persistence ('settings.theme') and applies the `dark` class, so
// the segment reads straight from it instead of keeping a second copy in sync.
const { theme, setTheme } = useTheme();

const wakeLockSupported = isWakeLockSupported();

const pageScale = computed(() => preferencesStore.pageScale);
const keepScreenAwake = computed(() => preferencesStore.keepScreenAwake);
// Reka's Slider works on number[] (multi-thumb capable) — bridge to the scalar store value.
const pageScaleSlider = computed<number[] | undefined>({
    get: () => [preferencesStore.pageScale],
    set: (value) => {
        const scale = value?.[0];
        if (typeof scale === 'number') {
            preferencesStore.setPageScale(scale);
        }
    },
});

const beyondFitChosen = computed(() => preferencesStore.beyondFitChosen);
const beyondFit = computed<NotationBeyondFit>({
    get: () => preferencesStore.beyondFit,
    set: (value) => preferencesStore.setNotationBeyondFit(value),
});

function onThemeModeChange(value: AcceptableValue | AcceptableValue[]) {
    if (value === 'system' || value === 'light' || value === 'dark') {
        setTheme(value);
    }
}
</script>
