<template>
    <!-- The transport sits at the foot of the page, so the desktop form opens
         upward over it rather than off the bottom of the screen. -->
    <ResponsivePanel
        :open="open"
        :anchor="anchor"
        label="Tempo"
        side="top"
        align="end"
        popover-class="w-80"
        @update:open="emit('update:open', $event)"
    >
        <div class="space-y-3 p-4">
            <PanelTitle>Tempo</PanelTitle>

            <ul class="space-y-2">
                <li v-for="preset in TEMPO_PRESETS" :key="preset.key">
                    <button
                        type="button"
                        class="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                        :class="
                            preset.key === chosen.key
                                ? 'border-gold/50 bg-gold/5'
                                : 'border-border bg-transparent'
                        "
                        :aria-pressed="preset.key === chosen.key"
                        @click="emit('update:tempo', preset.bpm)"
                    >
                        <component
                            :is="preset.icon"
                            class="size-5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <span class="min-w-0 flex-1">
                            <span class="block text-[0.9375rem] font-medium">
                                {{ preset.label }}
                            </span>
                            <span class="block text-sm text-muted-foreground">
                                {{ preset.hint }}
                            </span>
                        </span>
                        <!-- The digits belong to whoever asked for them. With
                             the exact control off, a number beside the word
                             would only raise the question it is meant to spare
                             the reader. -->
                        <span
                            v-if="exactTempo"
                            class="number-display shrink-0 text-sm text-muted-foreground"
                        >
                            {{ preset.bpm }}
                        </span>
                        <Check
                            v-if="preset.key === chosen.key"
                            class="size-4 shrink-0 text-primary"
                            :stroke-width="3"
                            aria-hidden="true"
                        />
                    </button>
                </li>
            </ul>

            <!-- Offered only where it was asked for: Einstellungen → Wiedergabe
                 → „Genaues Tempo". Everyone else has three words and is done. -->
            <div v-if="exactTempo" class="space-y-3 border-t border-border pt-3">
                <div class="flex items-center justify-between gap-3">
                    <span class="flex items-center gap-2.5 text-sm font-medium">
                        <Gauge class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        Genaues Tempo
                    </span>
                    <div class="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            :disabled="tempo <= TEMPO_MIN"
                            aria-label="Tempo verringern"
                            @click="emit('update:tempo', stepTempo(tempo, -1))"
                        >
                            <Minus aria-hidden="true" />
                        </Button>
                        <span
                            class="number-display min-w-[4.5rem] text-center text-lg leading-none"
                        >
                            {{ tempo }}
                            <span class="text-xs text-muted-foreground">BPM</span>
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            :disabled="tempo >= TEMPO_MAX"
                            aria-label="Tempo erhöhen"
                            @click="emit('update:tempo', stepTempo(tempo, 1))"
                        >
                            <Plus aria-hidden="true" />
                        </Button>
                    </div>
                </div>
                <Slider
                    :model-value="[tempo]"
                    :min="TEMPO_MIN"
                    :max="TEMPO_MAX"
                    :step="TEMPO_STEP"
                    aria-label="Tempo in BPM"
                    @update:model-value="onSlide"
                />
            </div>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Check, Gauge, Minus, Plus } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';
import { Slider } from '@/components/ui/slider';

import type { PanelAnchor } from '@/lib/anchor';

import {
    TEMPO_MAX,
    TEMPO_MIN,
    TEMPO_PRESETS,
    TEMPO_STEP,
    clampTempo,
    presetForTempo,
    stepTempo,
} from './playbackTempo';

const props = defineProps<{
    open: boolean;
    /** Beats per minute the playback is set to */
    tempo: number;
    /** Whether this reader has asked for the BPM control as well as the words */
    exactTempo: boolean;
    anchor?: PanelAnchor;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:tempo': [bpm: number];
}>();

/** Every tempo reads as a preset, including one set by hand — see presetForTempo. */
const chosen = computed(() => presetForTempo(props.tempo));

function onSlide(value: number[] | undefined) {
    if (value?.length) emit('update:tempo', clampTempo(value[0]));
}
</script>
