<template>
    <ResponsivePanel
        :open="open"
        :anchor="anchor"
        label="Wiederholen"
        side="top"
        align="start"
        popover-class="w-80"
        @update:open="emit('update:open', $event)"
    >
        <div class="space-y-3 p-4">
            <PanelTitle>Wiederholen</PanelTitle>
            <!-- Said once, because the count is otherwise a number without a
                 unit: a hymn of four verses is played four times, and the
                 melody is what repeats while the reader moves down the page. -->
            <p class="text-sm leading-snug text-muted-foreground">
                Wie oft die Melodie gespielt wird — eine Strophe je Durchgang.
            </p>

            <ul class="space-y-2">
                <li>
                    <button
                        type="button"
                        :class="rowClass(mode === 'once')"
                        :aria-pressed="mode === 'once'"
                        @click="emit('update:times', REPEAT_ONCE)"
                    >
                        <Play class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span class="min-w-0 flex-1">
                            <span class="block text-[15px] font-medium">Einmal</span>
                            <span class="block text-sm text-muted-foreground">
                                Ohne Wiederholung
                            </span>
                        </span>
                        <Check
                            v-if="mode === 'once'"
                            class="size-4 shrink-0 text-primary"
                            :stroke-width="3"
                            aria-hidden="true"
                        />
                    </button>
                </li>

                <li>
                    <!-- The count opens on the number of verses: that is what
                         anyone repeating a hymn is counting, and it makes the
                         common case a single tap. -->
                    <button
                        type="button"
                        :class="rowClass(mode === 'counted')"
                        :aria-pressed="mode === 'counted'"
                        @click="emit('update:times', count)"
                    >
                        <Repeat class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span class="min-w-0 flex-1">
                            <span class="block text-[15px] font-medium">
                                <span class="number-display">{{ count }}</span>
                                Durchgänge
                            </span>
                            <span class="block text-sm text-muted-foreground">
                                {{ count === verseCount ? verseHint : 'Eigene Anzahl' }}
                            </span>
                        </span>
                        <Check
                            v-if="mode === 'counted'"
                            class="size-4 shrink-0 text-primary"
                            :stroke-width="3"
                            aria-hidden="true"
                        />
                    </button>

                    <!-- Belongs to the row above and appears with it: a stepper
                         standing over a chosen „Einmal" would be a control with
                         nothing to count. -->
                    <div
                        v-if="mode === 'counted'"
                        class="mt-2 flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
                    >
                        <span class="text-sm text-muted-foreground">Anzahl</span>
                        <div class="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                :disabled="count <= REPEAT_ONCE + 1"
                                aria-label="Ein Durchgang weniger"
                                @click="emit('update:times', clampRepeat(count - 1))"
                            >
                                <Minus aria-hidden="true" />
                            </Button>
                            <span class="number-display min-w-10 text-center text-lg leading-none">
                                {{ count }}×
                            </span>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                :disabled="count >= REPEAT_MAX"
                                aria-label="Ein Durchgang mehr"
                                @click="emit('update:times', clampRepeat(count + 1))"
                            >
                                <Plus aria-hidden="true" />
                            </Button>
                        </div>
                    </div>
                </li>

                <li>
                    <button
                        type="button"
                        :class="rowClass(mode === 'endless')"
                        :aria-pressed="mode === 'endless'"
                        @click="emit('update:times', REPEAT_ENDLESS)"
                    >
                        <InfinityIcon
                            class="size-5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <span class="min-w-0 flex-1">
                            <span class="block text-[15px] font-medium">Endlos</span>
                            <span class="block text-sm text-muted-foreground">
                                Bis Sie anhalten
                            </span>
                        </span>
                        <Check
                            v-if="mode === 'endless'"
                            class="size-4 shrink-0 text-primary"
                            :stroke-width="3"
                            aria-hidden="true"
                        />
                    </button>
                </li>
            </ul>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Infinity as InfinityIcon, Check, Minus, Play, Plus, Repeat } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';

import type { PanelAnchor } from '@/lib/anchor';

import {
    REPEAT_ENDLESS,
    REPEAT_MAX,
    REPEAT_ONCE,
    clampRepeat,
    isEndless,
    proposedRepeat,
} from './playbackRepeat';

const props = defineProps<{
    open: boolean;
    /** How often the song is played through — 1 is once, Infinity is endless */
    times: number;
    /** How many verses are to be sung, which is what the count opens on */
    verseCount: number;
    /** What that number is — usually the hymn's verses, but a service singing
     *  three of seven counts three, and the row has to say which it means. */
    verseHint?: string;
    anchor?: PanelAnchor;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:times': [times: number];
}>();

const verseHint = computed(() => props.verseHint ?? 'Für alle Strophen');

const mode = computed<'once' | 'counted' | 'endless'>(() => {
    if (isEndless(props.times)) return 'endless';
    return clampRepeat(props.times) > REPEAT_ONCE ? 'counted' : 'once';
});

/** The number the counted row shows: the one in force, or the one proposed. */
const count = computed(() =>
    mode.value === 'counted' ? clampRepeat(props.times) : proposedRepeat(props.verseCount),
);

function rowClass(active: boolean): string {
    return [
        'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted',
        active ? 'border-gold/50 bg-gold/5' : 'border-border bg-transparent',
    ].join(' ');
}
</script>
