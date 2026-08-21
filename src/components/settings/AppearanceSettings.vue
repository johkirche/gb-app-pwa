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

        <div class="flex items-center justify-between gap-4 px-2 py-3">
            <div class="flex min-w-0 items-center gap-4">
                <Image class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Label for="settings-melody-mode" class="text-[15px] font-normal">
                    Notenansicht
                </Label>
            </div>
            <Select v-model="melodyDisplayMode">
                <SelectTrigger id="settings-melody-mode" class="w-36 shrink-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="image">Notenbild</SelectItem>
                    <SelectItem value="xml">MusicXML</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <!-- One size for the song page: notation and verses alike. They are set
             at the same size in the book, so two controls could only pull them
             apart. -->
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
        </div>
    </SettingsList>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Contrast, Image, Type } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';

import { usePreferencesStore } from '@/stores/preferences';

import { useTheme } from '@/composables/useTheme';

import SettingsList from '@/components/settings/SettingsList.vue';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const preferencesStore = usePreferencesStore();
// useTheme owns persistence ('settings.theme') and applies the `dark` class, so
// the segment reads straight from it instead of keeping a second copy in sync.
const { theme, setTheme } = useTheme();

const pageScale = computed(() => preferencesStore.pageScale);
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

const melodyDisplayMode = computed<AcceptableValue>({
    get: () => preferencesStore.melodyDisplayMode,
    set: (value) => {
        if (value === 'image' || value === 'xml') {
            preferencesStore.setMelodyDisplayMode(value);
        }
    },
});

function onThemeModeChange(value: AcceptableValue | AcceptableValue[]) {
    if (value === 'system' || value === 'light' || value === 'dark') {
        setTheme(value);
    }
}
</script>
