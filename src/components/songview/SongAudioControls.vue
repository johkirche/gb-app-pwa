<template>
    <div class="page-col flex flex-col gap-1.5 py-2">
        <!-- Where the song stands, and how to move it there -->
        <div class="flex items-center gap-3">
            <span class="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {{ formatTime(shownPosition) }}
            </span>
            <Slider
                :model-value="[shownPosition]"
                :max="sliderMax"
                :step="0.05"
                :disabled="duration <= 0"
                aria-label="Position im Lied"
                class="flex-1"
                @update:model-value="onScrub"
                @value-commit="onCommit"
            />
            <span class="w-9 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {{ formatTime(duration) }}
            </span>
        </div>

        <!-- How playback behaves on the left, the transport in the middle,
             tempo on the right: the middle then stays on the page's axis
             whatever the two sides are as wide as. -->
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div class="flex items-center justify-self-start">
                <Button
                    variant="ghost"
                    size="icon"
                    :class="
                        loopEnabled ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    "
                    :aria-pressed="loopEnabled"
                    aria-label="Wiederholung"
                    @click="$emit('update:loopEnabled', !loopEnabled)"
                >
                    <Repeat class="!size-5" aria-hidden="true" />
                </Button>

                <!-- Silent playback: the page still follows the song note by
                     note, there is just nothing to hear. -->
                <Button
                    variant="ghost"
                    size="icon"
                    :class="muted ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
                    :aria-pressed="muted"
                    :aria-label="muted ? 'Ton einschalten' : 'Ton ausschalten'"
                    @click="$emit('update:muted', !muted)"
                >
                    <VolumeX v-if="muted" class="!size-5" aria-hidden="true" />
                    <Volume2 v-else class="!size-5" aria-hidden="true" />
                </Button>
            </div>

            <div class="flex items-center gap-2 justify-self-center">
                <Button
                    variant="ghost"
                    size="icon"
                    class="text-muted-foreground"
                    :disabled="!canRewind"
                    aria-label="Zum Anfang"
                    @click="$emit('stop')"
                >
                    <SkipBack class="!size-5" aria-hidden="true" />
                </Button>

                <Button
                    size="icon"
                    :class="
                        cn(
                            'size-12 rounded-full transition-shadow',
                            // A quiet halo while the song runs, so the state
                            // reads from across a room, not only from the icon.
                            isPlaying &&
                                'shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)]',
                        )
                    "
                    :aria-label="isPlaying ? 'Pause' : 'Wiedergabe'"
                    @click="$emit('togglePlay')"
                >
                    <LoaderCircle
                        v-if="isLoading"
                        class="!size-5 animate-spin"
                        aria-hidden="true"
                    />
                    <Pause v-else-if="isPlaying" class="!size-5 fill-current" aria-hidden="true" />
                    <!-- A triangle centres optically a hair right of centre -->
                    <Play v-else class="!size-5 translate-x-px fill-current" aria-hidden="true" />
                </Button>
            </div>

            <div class="flex items-center gap-1 justify-self-end">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Tempo verringern"
                    @click="$emit('decreaseTempo')"
                >
                    <Minus aria-hidden="true" />
                </Button>
                <span
                    class="min-w-[58px] text-center text-sm font-medium tabular-nums text-muted-foreground"
                >
                    {{ tempo }} BPM
                </span>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Tempo erhöhen"
                    @click="$emit('increaseTempo')"
                >
                    <Plus aria-hidden="true" />
                </Button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import {
    LoaderCircle,
    Minus,
    Pause,
    Play,
    Plus,
    Repeat,
    SkipBack,
    Volume2,
    VolumeX,
} from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

import { cn } from '@/lib/utils';

const props = defineProps<{
    isPlaying: boolean;
    /** The soundfont is being fetched — the first tap costs seconds */
    isLoading?: boolean;
    hasPaused: boolean;
    loopEnabled: boolean;
    muted: boolean;
    tempo: number;
    /** Seconds played, and the song's length at the current tempo */
    position: number;
    duration: number;
}>();

const emit = defineEmits<{
    togglePlay: [];
    stop: [];
    /** A position on the bar, as a fraction of the song */
    seek: [fraction: number];
    increaseTempo: [];
    decreaseTempo: [];
    'update:loopEnabled': [value: boolean];
    'update:muted': [value: boolean];
}>();

// While a finger is on the bar the handle follows the finger, not the music —
// otherwise the incoming position would drag it back on every frame.
const scrubPosition = ref<number | null>(null);

const shownPosition = computed(() => scrubPosition.value ?? props.position);
// A zero-length track would put the handle at the far right; the bar is
// disabled at that point anyway.
const sliderMax = computed(() => (props.duration > 0 ? props.duration : 1));
const canRewind = computed(() => props.hasPaused || props.position > 0);

function onScrub(value: number[] | undefined) {
    if (value?.length) scrubPosition.value = value[0];
}

function onCommit(value: number[] | undefined) {
    if (value?.length && props.duration > 0) emit('seek', value[0] / props.duration);
    // Released on the next tick, not this one: a keyboard step commits BEFORE
    // it reports the new value, so clearing right here would be undone by the
    // report that follows and the bar would stop following the music.
    nextTick(() => {
        scrubPosition.value = null;
    });
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
</script>
