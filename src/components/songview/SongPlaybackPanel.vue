<template>
    <!-- The transport sits at the foot of the page, so the desktop form opens
         upward over it rather than off the bottom of the screen. -->
    <ResponsivePanel
        :open="open"
        :anchor="anchor"
        :label="title"
        side="top"
        align="end"
        popover-class="w-80"
        @update:open="emit('update:open', $event)"
    >
        <div class="space-y-3 p-4">
            <PanelTitle>{{ title }}</PanelTitle>

            <!-- Named only where there is a second thing to tell it from. With
                 the Tonhöhe off, this panel is the Tempo and says so above. -->
            <p v-if="pitchControl" class="label-micro text-muted-foreground">Tempo</p>

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

            <!-- How high, under how fast: both are how this hymn is played, and
                 a bar that carried them as two buttons crowded its own right
                 side while the left stood half empty. Offered only where it was
                 asked for: Einstellungen → Wiedergabe → „Tonhöhe ändern". -->
            <div v-if="pitchControl" class="space-y-3 border-t border-border pt-3">
                <p class="label-micro text-muted-foreground">Tonhöhe</p>

                <div class="flex items-center justify-between gap-3">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        :disabled="transpose <= PITCH_MIN"
                        aria-label="Tiefer spielen"
                        @click="emit('update:transpose', stepPitch(transpose, -1))"
                    >
                        <Minus aria-hidden="true" />
                    </Button>
                    <!-- The key the hymn sounds in, where the sheet named one at
                         all — that is the answer a leader came for, and the
                         half-tones below it only say which way it was moved. -->
                    <span class="min-w-0 flex-1 text-center">
                        <span class="block text-lg font-medium leading-tight">{{ sounding }}</span>
                        <span class="block text-sm text-muted-foreground">
                            {{ pitchHint(transpose) }}
                        </span>
                    </span>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        :disabled="transpose >= PITCH_MAX"
                        aria-label="Höher spielen"
                        @click="emit('update:transpose', stepPitch(transpose, 1))"
                    >
                        <Plus aria-hidden="true" />
                    </Button>
                </div>

                <!-- Said plainly, because the page does not move with the sound:
                     a key name over an engraving in another key would otherwise
                     read as a fault in the app rather than as the point of the
                     control. Kept to one line, and to the same line in every
                     state: this sentence is the only thing here that changes
                     length, and a panel that grew a line as the reader stepped a
                     half-tone would move the +/− out from under their thumb. -->
                <p class="text-sm text-muted-foreground">{{ notice }}</p>

                <Button
                    variant="ghost"
                    size="sm"
                    class="w-full gap-2"
                    :disabled="transpose === PITCH_NONE"
                    @click="emit('update:transpose', PITCH_NONE)"
                >
                    <RotateCcw class="size-4" aria-hidden="true" />
                    Wie notiert spielen
                </Button>
            </div>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Check, Gauge, Minus, Plus, RotateCcw } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';
import { Slider } from '@/components/ui/slider';

import type { PanelAnchor } from '@/lib/anchor';

import {
    PITCH_MAX,
    PITCH_MIN,
    PITCH_NONE,
    type SongKey,
    germanKeyName,
    pitchHint,
    pitchLabel,
    soundingKeyName,
    stepPitch,
} from './playbackPitch';
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
    /** How many half-tones the playback sounds from the printed key */
    transpose: number;
    /** The key the sheet is written in, where it states one */
    songKey: SongKey | null;
    /** Whether this reader has asked for the Tonhöhe control at all */
    pitchControl: boolean;
    anchor?: PanelAnchor;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:tempo': [bpm: number];
    'update:transpose': [semitones: number];
}>();

/** One thing or two, and the panel is named for what it actually holds. */
const title = computed(() => (props.pitchControl ? 'Wiedergabe' : 'Tempo'));

/** Every tempo reads as a preset, including one set by hand — see presetForTempo. */
const chosen = computed(() => presetForTempo(props.tempo));

/** What is heard: the key it comes out in, or plain half-tones for a sheet that names none. */
const sounding = computed(
    () => soundingKeyName(props.songKey, props.transpose) ?? pitchLabel(props.transpose),
);

/** What the sheet on the page still says, which the offset never changes. */
const printed = computed(() => (props.songKey ? germanKeyName(props.songKey) : null));

const notice = computed(() => {
    if (props.transpose === PITCH_NONE) {
        return printed.value
            ? `Die Noten stehen in ${printed.value}.`
            : 'Verschiebt nur die Wiedergabe.';
    }
    return printed.value
        ? `Die Noten bleiben in ${printed.value}.`
        : 'Nur die Wiedergabe, nicht die Noten.';
});

function onSlide(value: number[] | undefined) {
    if (value?.length) emit('update:tempo', clampTempo(value[0]));
}
</script>
