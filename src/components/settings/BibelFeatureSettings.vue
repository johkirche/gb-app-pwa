<template>
    <!-- Einstellungen → Bibel → Funktionen: what the reader can do with the
         text, each with a sample of how it looks in the reader and the one
         gesture that reaches it — a feature nobody can find is no feature. Its
         own page, so the Bibel section keeps to the few settings everyone needs. -->
    <SettingsList>
        <!-- What the reader always does, whatever is switched on below: none of
             it is a button anyone would go looking for. -->
        <p class="label-micro px-2 pb-1 pt-1 text-gold">So lesen Sie</p>
        <div class="px-2 py-3">
            <div class="flex items-center gap-4">
                <Pointer class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p class="text-[15px]">Verse auswählen, blättern, Kapitel wählen</p>
            </div>
            <BibelFeaturePreview feature="lesen" class="ml-9" />
        </div>

        <!-- Switching one off takes its controls and sections away and keeps
             what was stored for it. -->
        <p class="label-micro px-2 pb-1 pt-4 text-gold">Funktionen</p>
        <div v-for="feature in BIBEL_FEATURE_LIST" :key="feature.key" class="px-2 py-3">
            <div class="flex items-center justify-between gap-4">
                <div class="flex min-w-0 items-center gap-4">
                    <component
                        :is="feature.icon"
                        class="size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <div class="min-w-0">
                        <Label
                            :for="`settings-bibel-${feature.key}`"
                            class="text-[15px] font-normal"
                        >
                            {{ feature.label }}
                        </Label>
                        <p class="text-sm text-muted-foreground">{{ feature.description }}</p>
                    </div>
                </div>
                <Switch
                    :id="`settings-bibel-${feature.key}`"
                    :model-value="preferencesStore.bibelFeatures[feature.key]"
                    @update:model-value="preferencesStore.setBibelFeature(feature.key, $event)"
                />
            </div>
            <BibelFeaturePreview
                :feature="feature.key"
                :off="!preferencesStore.bibelFeatures[feature.key]"
                class="ml-9"
            />
        </div>
    </SettingsList>

    <component :is="DevBibelDemoData" v-if="DevBibelDemoData" />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

import { Pointer } from 'lucide-vue-next';

import { usePreferencesStore } from '@/stores/preferences';

import BibelFeaturePreview from '@/components/settings/BibelFeaturePreview.vue';
import SettingsList from '@/components/settings/SettingsList.vue';
import { BIBEL_FEATURE_LIST } from '@/components/settings/bibelFeatures';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const preferencesStore = usePreferencesStore();

// Development only: import.meta.env.DEV is replaced at build time, so the
// production bundle never contains the demo-data tool (cf. DevSkipButton).
const DevBibelDemoData = import.meta.env.DEV
    ? defineAsyncComponent(() => import('@/components/dev/DevBibelDemoData.vue'))
    : null;
</script>
