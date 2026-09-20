<template>
    <!-- A container, so the transport can answer to its own width rather than
         to the viewport's: it is the same bar on a phone and in the middle of a
         wide page, and only its own measure says whether a word still fits. -->
    <div class="page-col @container flex flex-col gap-1.5 py-2">
        <!-- Where the song stands, and how to move it there -->
        <div class="flex items-center gap-3">
            <span
                class="w-9 shrink-0 text-right text-[0.6875rem] tabular-nums text-muted-foreground"
            >
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
            <span class="w-9 shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
                {{ formatTime(duration) }}
            </span>
        </div>

        <!-- The play button owns the middle column and holds nothing else, so
             the two 1fr columns beside it stay equal and it sits on the page's
             axis whatever they come to hold. Each of those columns then runs
             from the page's edge to the transport: the settings — how often,
             how fast — at the outside, the two controls that act on the music
             now drawn in beside the play button. -->
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            <div class="flex min-w-0 items-center justify-between gap-1">
                <Button
                    ref="repeatTriggerRef"
                    variant="ghost"
                    size="sm"
                    class="h-10 min-w-10 gap-1.5 px-1.5"
                    :class="repeats ? 'text-foreground' : 'text-muted-foreground'"
                    :aria-label="repeatLabel(repeatTimes)"
                    aria-haspopup="dialog"
                    :aria-expanded="repeatPanelOpen"
                    @click="repeatPanelOpen = !repeatPanelOpen"
                >
                    <Repeat class="!size-5" aria-hidden="true" />
                    <span v-if="repeatBadgeText" class="number-display text-[0.8125rem]">
                        {{ repeatBadgeText }}
                    </span>
                </Button>

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
            </div>

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
                <LoaderCircle v-if="isLoading" class="!size-5 animate-spin" aria-hidden="true" />
                <Pause v-else-if="isPlaying" class="!size-5 fill-current" aria-hidden="true" />
                <!-- A triangle centres optically a hair right of centre -->
                <Play v-else class="!size-5 translate-x-px fill-current" aria-hidden="true" />
            </Button>

            <div class="flex min-w-0 items-center justify-between gap-1">
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

                <!-- How the hymn is played: in a word, not in beats per minute
                     — nobody looking up a hymn wants to be asked for a number,
                     and the one behind the word is offered to whoever turns it
                     on in the settings. With „Tonhöhe ändern" on, how high goes
                     in beside how fast rather than taking a button of its own:
                     two settings at this end and two controls at the other is
                     the balance the bar was drawn at. See playbackTempo and
                     playbackPitch. -->
                <Button
                    ref="settingsTriggerRef"
                    variant="ghost"
                    size="sm"
                    class="h-10 min-w-10 gap-1.5 px-1.5"
                    :class="transposed ? 'text-foreground' : 'text-muted-foreground'"
                    :aria-label="settingsLabel"
                    aria-haspopup="dialog"
                    :aria-expanded="panelOpen"
                    @click="panelOpen = !panelOpen"
                >
                    <component
                        :is="settingsIcon"
                        class="!size-5"
                        :class="transposed && '@max-[20.625rem]:hidden'"
                        aria-hidden="true"
                    />
                    <!-- Where the word has been given up, the tempo's icon
                         stands aside for this one: a hymn sounding in another
                         key than it stands in is the thing a bar too narrow for
                         words still has to be able to say. -->
                    <component
                        :is="PITCH_ICON"
                        v-if="transposed"
                        class="!size-5 @min-[20.625rem]:hidden"
                        aria-hidden="true"
                    />
                    <!-- Narrower than this and the word would have to be cut
                         short, which says less than the icon on its own does.
                         The button is named either way, so nothing is lost to
                         a reader who is listening rather than looking. In rem,
                         so that enlarging the app gives the word up before the
                         bar runs off the side of the phone. -->
                    <span class="hidden truncate text-[0.8125rem] @min-[20.625rem]:inline">
                        {{ settingsBadge }}
                    </span>
                </Button>
            </div>
        </div>

        <SongRepeatPanel
            v-model:open="repeatPanelOpen"
            :times="repeatTimes"
            :verse-count="verseCount"
            :verse-hint="verseHint"
            :anchor="repeatAnchor"
            @update:times="$emit('update:repeatTimes', $event)"
        />

        <SongPlaybackPanel
            v-model:open="panelOpen"
            :tempo="tempo"
            :exact-tempo="exactTempo"
            :transpose="transpose"
            :song-key="songKey"
            :pitch-control="pitchControl"
            :anchor="settingsAnchor"
            @update:tempo="$emit('update:tempo', $event)"
            @update:transpose="$emit('update:transpose', $event)"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import { LoaderCircle, Pause, Play, Repeat, SkipBack, Volume2, VolumeX } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

import type { PanelAnchor } from '@/lib/anchor';
import { cn } from '@/lib/utils';

import SongPlaybackPanel from './SongPlaybackPanel.vue';
import SongRepeatPanel from './SongRepeatPanel.vue';
import {
    PITCH_ICON,
    PITCH_NONE,
    type SongKey,
    pitchHint,
    pitchLabel,
    soundingKeyName,
} from './playbackPitch';
import { REPEAT_ONCE, repeatBadge, repeatLabel } from './playbackRepeat';
import { presetForTempo } from './playbackTempo';

const props = defineProps<{
    isPlaying: boolean;
    /** The soundfont is being fetched — the first tap costs seconds */
    isLoading?: boolean;
    hasPaused: boolean;
    /** How often the song is played through — 1 is once, Infinity is endless */
    repeatTimes: number;
    /** How many verses are to be sung, which is what the repeat count opens on */
    verseCount: number;
    /** What that number counts, where it is not simply the hymn's verses */
    verseHint?: string;
    muted: boolean;
    tempo: number;
    /** Whether this reader has asked for the tempo in BPM as well as in words */
    exactTempo: boolean;
    /** How many half-tones the playback sounds from the printed key */
    transpose: number;
    /** The key the sheet is written in, where it states one */
    songKey: SongKey | null;
    /** Whether this reader has asked for the Tonhöhe control at all */
    pitchControl: boolean;
    /** Seconds played, and the song's length at the current tempo */
    position: number;
    duration: number;
}>();

const emit = defineEmits<{
    togglePlay: [];
    stop: [];
    /** A position on the bar, as a fraction of the song */
    seek: [fraction: number];
    'update:tempo': [bpm: number];
    'update:transpose': [semitones: number];
    'update:repeatTimes': [times: number];
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

const repeats = computed(() => props.repeatTimes !== REPEAT_ONCE);
const repeatBadgeText = computed(() => repeatBadge(props.repeatTimes));

const tempoPreset = computed(() => presetForTempo(props.tempo));
// With the exact control on, the number is what the reader is steering by and
// the word would only take room from it.
const tempoLabel = computed(() =>
    props.exactTempo ? `${props.tempo} BPM` : tempoPreset.value.label,
);

const transposed = computed(() => props.transpose !== PITCH_NONE);
// The key it comes out in — which is the printed one until somebody moves it,
// and plain half-tones for a sheet that states no key at all.
const pitchButtonLabel = computed(
    () => soundingKeyName(props.songKey, props.transpose) ?? pitchLabel(props.transpose),
);

// One button for both, and it shows both without asking for a second word's
// worth of room: the icon has always said how fast — Turtle, note, Rabbit —
// so the word beside it is free to say what key, from the moment there is a
// key to say. Until then it says the tempo in words, as it always did.
const settingsIcon = computed(() => tempoPreset.value.icon);
const settingsBadge = computed(() =>
    transposed.value ? pitchButtonLabel.value : tempoLabel.value,
);
// Spoken in full, because the word on the button is only ever one of the two.
const settingsLabel = computed(() =>
    props.pitchControl
        ? `Wiedergabe: Tempo ${tempoLabel.value}, Tonhöhe ${pitchButtonLabel.value}, ${pitchHint(props.transpose)}`
        : `Tempo: ${tempoLabel.value}`,
);

// Both panels open off the button that carries them, so on a wide screen the
// popover stands over its own control rather than in the corner of the page.
const repeatPanelOpen = ref(false);
const panelOpen = ref(false);
const repeatTriggerRef = ref<{ $el?: HTMLElement } | null>(null);
const settingsTriggerRef = ref<{ $el?: HTMLElement } | null>(null);
const repeatAnchor = computed<PanelAnchor>(() => repeatTriggerRef.value?.$el ?? null);
const settingsAnchor = computed<PanelAnchor>(() => settingsTriggerRef.value?.$el ?? null);

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
