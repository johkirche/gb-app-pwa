<template>
    <!-- A sketch of the app, not a screenshot: drawn in its own parts and
         colours, so it is right in dark mode and at every Größe, and shows no
         hymn it would have to be allowed to show. Decoration only — the text
         under it says everything. Everything is in rem and nothing has a
         fixed width, so the sketch grows with the type and never past the
         phone. -->
    <div
        class="flex min-h-[15.5rem] w-full items-center justify-center overflow-hidden rounded-2xl bg-muted px-6 py-6"
        aria-hidden="true"
    >
        <!-- Lieder finden: a search for a number, and what it finds -->
        <div v-if="kind === 'suchen'" class="w-full max-w-[18rem] space-y-3">
            <div
                class="flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 shadow-sm"
            >
                <Search class="size-[1.125rem] shrink-0 text-muted-foreground" />
                <span class="text-[0.9375rem]">23</span>
                <span class="h-[1.1em] w-px animate-pulse bg-foreground" />
            </div>
            <div
                v-for="(number, i) in ['23', '123', '230']"
                :key="number"
                class="flex items-center gap-3 rounded-lg bg-background/70 px-3 py-1.5"
            >
                <span class="w-[2.5em] shrink-0 font-display text-lg tabular-nums">
                    {{ number }}
                </span>
                <!-- The bar's length is a share of the room left beside the
                     number, so it can never take more than there is. -->
                <span class="min-w-0 flex-1">
                    <span
                        class="block h-2 rounded-full bg-foreground/15"
                        :class="['w-full', 'w-2/3', 'w-1/2'][i]"
                    />
                </span>
            </div>
        </div>

        <!-- Größer lesen: one size for everything -->
        <div
            v-else-if="kind === 'groesse'"
            class="flex w-full max-w-[18rem] flex-col items-center gap-6"
        >
            <div class="flex flex-wrap items-baseline justify-center gap-x-4 font-display">
                <span class="text-xl text-foreground/40">Aa</span>
                <span class="text-3xl text-foreground/70">Aa</span>
                <span class="text-5xl text-foreground">Aa</span>
            </div>
            <div class="relative h-1.5 w-full rounded-full bg-foreground/15">
                <div class="absolute inset-y-0 left-0 w-[70%] rounded-full bg-primary" />
                <div
                    class="absolute left-[70%] top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-sm"
                />
            </div>
        </div>

        <!-- Melodie anhören: a stave, the sounding note marked -->
        <div v-else-if="kind === 'hoeren'" class="w-full max-w-[18rem] space-y-6">
            <div class="relative h-[4.5rem]">
                <span
                    v-for="line in 5"
                    :key="line"
                    class="absolute inset-x-0 h-px bg-foreground/30"
                    :style="{ top: `${(line - 1) * 25}%` }"
                />
                <span
                    class="absolute -inset-y-3 w-0.5 rounded-full bg-primary/40"
                    style="left: 56%"
                />
                <span
                    v-for="note in NOTES"
                    :key="note.left"
                    class="absolute h-[0.7rem] w-[0.95rem] -translate-x-1/2 -translate-y-1/2 -rotate-[20deg] rounded-[50%]"
                    :class="note.sounding ? 'bg-primary' : 'bg-foreground/70'"
                    :style="{ left: `${note.left}%`, top: `${note.top}%` }"
                />
            </div>
            <div class="flex items-center gap-4">
                <span
                    class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                    <Play class="size-5 translate-x-px fill-current" />
                </span>
                <span class="relative h-1.5 min-w-0 flex-1 rounded-full bg-foreground/15">
                    <span class="absolute inset-y-0 left-0 w-[45%] rounded-full bg-primary/60" />
                </span>
            </div>
        </div>

        <!-- Für den Gottesdienst: the songs in order, and the tab they get -->
        <div v-else-if="kind === 'ablauf'" class="w-full max-w-[18rem] space-y-2">
            <div
                v-for="(width, i) in ['w-3/4', 'w-1/2', 'w-2/3']"
                :key="i"
                class="flex items-center gap-3 rounded-lg bg-background px-3 py-2.5 shadow-sm"
            >
                <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                >
                    {{ i + 1 }}
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block h-2 rounded-full bg-foreground/15" :class="width" />
                </span>
            </div>
            <div
                class="!mt-5 flex items-center justify-around gap-2 rounded-xl border border-border bg-background px-2 py-2 text-muted-foreground"
            >
                <Music class="size-5 shrink-0" />
                <span
                    class="flex min-w-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-accent-foreground"
                >
                    <ClipboardList class="size-5 shrink-0" />
                    <span class="truncate text-sm font-medium">Ablauf</span>
                </span>
                <ListMusic class="size-5 shrink-0" />
                <Settings class="size-5 shrink-0" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ClipboardList, ListMusic, Music, Play, Search, Settings } from 'lucide-vue-next';

import type { TourKind } from '@/components/onboarding/tour';

defineProps<{ kind: TourKind }>();

/** A phrase that climbs and falls back, the fourth note sounding. Positions in % of the stave. */
const NOTES = [
    { left: 8, top: 75, sounding: false },
    { left: 24, top: 62.5, sounding: false },
    { left: 40, top: 50, sounding: false },
    { left: 56, top: 37.5, sounding: true },
    { left: 72, top: 50, sounding: false },
    { left: 88, top: 62.5, sounding: false },
];
</script>
