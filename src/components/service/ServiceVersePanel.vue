<template>
    <ResponsivePanel
        :open="isOpen"
        :anchor="anchor"
        label="Strophen wählen"
        :snap-points="snapPoints"
        :initial-snap-point="0.75"
        drawer-class="h-full max-h-[97dvh]"
        popover-class="w-80"
        @update:open="onOpenChange"
    >
        <div
            class="sticky top-0 z-20 flex items-start justify-between gap-2 bg-popover py-1 pl-4 pr-2"
        >
            <div class="min-w-0 pt-1.5">
                <PanelTitle>Strophen wählen</PanelTitle>
                <p v-if="song" class="mt-0.5 truncate text-sm text-muted-foreground">
                    <span v-if="song.index" class="number-display">{{ song.index }}.</span>
                    {{ song.titel }}
                </p>
            </div>
            <Button variant="ghost" class="shrink-0 text-primary" @click="toggleAll">
                {{ allChosen ? 'Keine' : 'Alle' }}
            </Button>
        </div>

        <p class="px-4 pb-1 pt-1 text-sm leading-snug text-muted-foreground">
            Tippen Sie die Strophen an, die gesungen werden. Die übrigen stehen im Lied blass — so,
            wie sie hier stehen.
        </p>

        <!-- No control beside the verses: the row is the verse, set the way it
             will be set in the song. A checkbox would be a second, weaker
             statement of what the type already makes, in a vocabulary this book
             does not otherwise speak. -->
        <ul class="px-3 py-1">
            <li v-for="verse in verses" :key="verse.number">
                <button
                    type="button"
                    class="flex w-full border-l-2 pr-1 text-left transition-colors hover:bg-muted active:bg-muted"
                    :class="chosen.has(verse.number) ? 'border-gold' : 'border-transparent'"
                    :aria-pressed="chosen.has(verse.number)"
                    @click="toggle(verse.number)"
                >
                    <!-- The verse recedes, the row does not: dimming the button
                         itself would take the tap feedback down with it, and on
                         a phone that feedback is the only answer a tap gets. -->
                    <span
                        class="flex min-w-0 flex-1 items-baseline gap-3 py-2.5 pl-3 transition-opacity"
                        :class="{ 'opacity-40': !chosen.has(verse.number) }"
                    >
                        <span class="number-display min-w-5 shrink-0 text-[15px]">
                            {{ verse.number }}.
                        </span>
                        <!-- Three lines: enough of the verse to know which one
                             it is, little enough that a seven-verse hymn is
                             still a list rather than a page to scroll. -->
                        <span class="line-clamp-3 min-w-0 flex-1 font-hymnal text-[15px] leading-6">
                            {{ verse.text }}
                        </span>
                    </span>
                </button>
            </li>
        </ul>

        <!-- Sticky so the choice can be saved without scrolling back down a
             seven-verse hymn. -->
        <div class="sticky bottom-0 z-20 mt-2 border-t border-border bg-popover px-4 py-3">
            <Button class="w-full" :disabled="chosen.size === 0" @click="save">
                {{ isInPlan ? 'Auswahl sichern' : 'Vormerken' }}
            </Button>
            <p class="mt-2 text-center text-[13px] text-muted-foreground">
                {{ summary }}
            </p>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { toast } from 'vue-sonner';

import { useServiceStore } from '@/stores/service';

import { Button } from '@/components/ui/button';
import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';

import type { Song } from '@/db';
import type { PanelAnchor } from '@/lib/anchor';
import {
    type VerseSelection,
    formatVerseSelection,
    normalizeVerseSelection,
} from '@/services/servicePlans';
import { verseText } from '@/utils/verses';

/**
 * Which verses of a hymn this service sings.
 *
 * It is the step between „vormerken" and the plan: the order of service names
 * two or three verses of a seven-verse hymn, and until that is written down
 * everybody at the lectern has to remember it. Opening it is therefore how a
 * song is marked at all — the panel does the marking itself, so its three call
 * sites (the song menu, the long press in the list, the Gottesdienst page) have
 * nothing to repeat.
 */
const props = defineProps<{
    isOpen: boolean;
    /** The hymn whose verses are being chosen. */
    song: Song | null;
    /** What the desktop popover opens against — the control that opened it. */
    anchor?: PanelAnchor;
}>();

const emit = defineEmits<{
    close: [];
    /** The verses that were saved — null for the whole hymn. */
    saved: [verses: VerseSelection];
}>();

const serviceStore = useServiceStore();

// Sheet snap points, as everywhere else in the app. It opens higher than the
// other panels because the list it shows is what is being decided.
const snapPoints = [0.5, 0.75, 1];

const verses = computed(() =>
    (props.song?.strophen ?? []).map((strophe, index) => ({
        number: index + 1,
        text: verseText(strophe),
    })),
);

const isInPlan = computed(() => (props.song ? serviceStore.isInPlan(props.song.id) : false));

const chosen = ref<Set<number>>(new Set());

const allChosen = computed(
    () => verses.value.length > 0 && chosen.value.size === verses.value.length,
);

/** The chosen numbers in the form the plan stores them. */
const selection = computed<VerseSelection>(() =>
    normalizeVerseSelection(chosen.value, verses.value.length),
);

const summary = computed(() => {
    if (chosen.value.size === 0) return 'Mindestens eine Strophe wählen';
    return formatVerseSelection(selection.value, verses.value.length);
});

// Every opening starts from what the plan says today — the verses already
// chosen for this song, or the whole hymn for one that is not on it yet.
watch(
    () => [props.isOpen, props.song?.id] as const,
    ([isOpen]) => {
        if (!isOpen || !props.song) return;
        const stored = serviceStore.versesFor(props.song.id);
        chosen.value = new Set(stored ?? verses.value.map((verse) => verse.number));
    },
    { immediate: true },
);

function onOpenChange(open: boolean) {
    if (!open) emit('close');
}

function toggle(number: number) {
    const next = new Set(chosen.value);
    if (next.has(number)) next.delete(number);
    else next.add(number);
    chosen.value = next;
}

function toggleAll() {
    chosen.value = allChosen.value ? new Set() : new Set(verses.value.map((verse) => verse.number));
}

async function save() {
    const song = props.song;
    if (!song || chosen.value.size === 0) return;

    const wasOnPlan = isInPlan.value;
    const verseSelection = selection.value;

    try {
        await serviceStore.markSong(song.id, verseSelection);
        emit('saved', verseSelection);
        emit('close');

        const what = formatVerseSelection(verseSelection, verses.value.length);
        toast.success(wasOnPlan ? `Gottesdienst · ${what}` : `Vorgemerkt · ${what}`, {
            duration: 2000,
        });
    } catch (err) {
        console.error('Failed to save the verse selection:', err);
        toast.error('Die Auswahl konnte nicht gespeichert werden.');
    }
}
</script>
