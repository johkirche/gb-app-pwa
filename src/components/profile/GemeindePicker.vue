<template>
    <div>
        <div v-if="listState === 'error'" class="flex flex-col items-start gap-3">
            <p class="text-sm leading-relaxed text-muted-foreground">
                Die Liste der Gemeinden konnte nicht geladen werden.
            </p>
            <Button type="button" variant="outline" @click="load">
                <RotateCw aria-hidden="true" />
                Erneut laden
            </Button>
        </div>

        <template v-else>
            <!-- Sticky rather than a scroller of its own for the list: at 200% the
                 heading above would leave such a scroller a row or two, where this
                 way the heading goes by first and the rows get the screen. -->
            <div ref="mapBarRef" :class="['sticky top-0 z-10 py-2', surface]">
                <GemeindeMap :gemeinden="gemeinden" :selected="selected" />
            </div>

            <!-- While the list is on its way: its shape, not a spinner. -->
            <div v-if="listState !== 'ready'" class="mt-1 flex flex-col gap-2" aria-hidden="true">
                <span v-for="n in 6" :key="n" class="h-14 animate-pulse rounded-lg bg-muted" />
            </div>

            <div v-else ref="listRef" class="mt-1" @keydown.capture="stopFollowing">
                <RadioGroupRoot
                    :model-value="modelValue?.id ?? NONE"
                    aria-label="Gemeinde"
                    loop
                    class="flex flex-col gap-2"
                    @update:model-value="onPick"
                >
                    <RadioGroupItem :value="NONE" :class="row">
                        <span class="block text-[0.9375rem] font-medium">Keine Angabe</span>
                    </RadioGroupItem>
                    <RadioGroupItem
                        v-for="gemeinde in gemeinden"
                        :key="gemeinde.id"
                        :value="gemeinde.id"
                        :class="row"
                    >
                        <span class="block text-[0.9375rem] font-medium">{{ gemeinde.name }}</span>
                        <span
                            v-if="gemeinde.place"
                            class="block text-sm text-muted-foreground group-data-[state=checked]:text-primary-foreground/80"
                        >
                            {{ gemeinde.place }}
                        </span>
                    </RadioGroupItem>
                </RadioGroupRoot>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { RotateCw } from 'lucide-vue-next';
import { type AcceptableValue, RadioGroupItem, RadioGroupRoot } from 'reka-ui';

import { useGemeinden } from '@/composables/useGemeinden';

import GemeindeMap from '@/components/profile/GemeindeMap.vue';
import { Button } from '@/components/ui/button';

import {
    type GemeindeOption,
    type GemeindeRef,
    listProgress,
    scrollTopAt,
} from '@/utils/gemeinden';
import { prefersReducedMotion } from '@/utils/motion';

const props = withDefaults(
    defineProps<{
        /** The chosen Gemeinde; null for none. */
        modelValue: GemeindeRef | null;
        /** What the rows pass behind the map on: it has to hide them. */
        surface?: string;
    }>(),
    { surface: 'bg-background' },
);

const emit = defineEmits<{ 'update:modelValue': [value: GemeindeRef | null] }>();

/** The radio value for „no Gemeinde": an id is a UUID, so it cannot be one. */
const NONE = 'none';

// Solid, because scrolling chooses: the row that is chosen has to stand out at a
// glance while the rows go by. The scroll margins are for a row reached by keyboard,
// so that it does not stop behind the map or behind the bar with the way on.
const row =
    'group w-full min-w-0 scroll-mt-[calc(30dvh+1rem)] scroll-mb-24 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:hover:bg-primary';

const { gemeinden, listState, load } = useGemeinden();

const mapBarRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);

const selected = computed(
    () => gemeinden.value.find((gemeinde) => gemeinde.id === props.modelValue?.id) ?? null,
);

// Scrolling chooses, but only a scroll by the reader's own hand. A keyboard or a
// screen reader scrolls too, on the way from row to row, and so does this picker
// when it brings a row into place; none of those may change the answer.
let readerScrolling = false;
// The choice as this picker last knew it, to tell one that came from outside.
let lastKnown: string | null | undefined;

function startFollowing() {
    readerScrolling = true;
}

function stopFollowing() {
    readerScrolling = false;
}

function scrollerOf(element: Element): Element {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent;
    }
    return document.scrollingElement ?? document.documentElement;
}

function rowsOf(list: HTMLElement): HTMLElement[] {
    return [...list.querySelectorAll<HTMLElement>('[role="radio"]')];
}

/** Where the list's travel starts and ends, as positions of its scroller. */
function travelOf(list: HTMLElement, mapBar: HTMLElement) {
    const scroller = scrollerOf(list);
    const edge = scroller === document.documentElement ? 0 : scroller.getBoundingClientRect().top;
    const listTop =
        list.getBoundingClientRect().top - edge - scroller.clientTop + scroller.scrollTop;
    return {
        scroller,
        start: listTop - mapBar.offsetHeight,
        end: scroller.scrollHeight - scroller.clientHeight,
    };
}

function choose(gemeinde: GemeindeOption | null) {
    lastKnown = gemeinde?.id ?? null;
    emit('update:modelValue', gemeinde ? { id: gemeinde.id, name: gemeinde.name } : null);
}

function followScroll(event: Event) {
    const list = listRef.value;
    const mapBar = mapBarRef.value;
    if (!readerScrolling || !list || !mapBar) return;
    if (!(event.target instanceof Node) || !event.target.contains(list)) return;

    const { scroller, start, end } = travelOf(list, mapBar);
    const box = list.getBoundingClientRect();
    const line = box.top + listProgress(scroller.scrollTop, start, end) * box.height;
    const rows = rowsOf(list);
    const reached = rows.findIndex((option) => option.getBoundingClientRect().bottom >= line);
    // The first row is „Keine Angabe", so the Gemeinden are one behind the rows.
    const gemeinde = gemeinden.value[(reached === -1 ? rows.length : reached) - 1] ?? null;
    if ((gemeinde?.id ?? null) !== (props.modelValue?.id ?? null)) choose(gemeinde);
}

// Scroll position and choice answer to each other, so that the next scroll goes on
// from the row that is chosen instead of jumping to another. „Keine Angabe" stands
// for the top of the page, where the heading is back in view.
function bringIntoPlace(rowIndex: number, behavior: 'auto' | 'smooth') {
    const list = listRef.value;
    const mapBar = mapBarRef.value;
    if (!list || !mapBar) return;
    const { scroller, start, end } = travelOf(list, mapBar);
    const option = rowsOf(list)[rowIndex];
    // Everything on the screen at once: there is nowhere to take it.
    if (!option || end <= start) return;

    const box = list.getBoundingClientRect();
    const { top, height } = option.getBoundingClientRect();
    const middle = (top + height / 2 - box.top) / box.height;
    scroller.scrollTo({ top: rowIndex === 0 ? 0 : scrollTopAt(middle, start, end), behavior });
}

function onPick(value: AcceptableValue) {
    stopFollowing();
    const index = gemeinden.value.findIndex((option) => option.id === value);
    choose(gemeinden.value[index] ?? null);
    bringIntoPlace(index + 1, prefersReducedMotion() ? 'auto' : 'smooth');
}

// A Gemeinde that was not chosen here: the saved one, on opening or as it comes
// down from the account. Twenty rows down, it would otherwise stay out of sight.
watch(
    [() => listState.value === 'ready', () => props.modelValue?.id ?? null],
    async ([ready, id]) => {
        if (!ready || id === lastKnown) return;
        lastKnown = id;
        stopFollowing();
        if (id === null) return;

        await nextTick();
        bringIntoPlace(gemeinden.value.findIndex((gemeinde) => gemeinde.id === id) + 1, 'auto');
    },
    { immediate: true },
);

/** A press on the scroller itself is a press on its scrollbar. */
function onPointerDown(event: PointerEvent) {
    if (listRef.value && event.target === scrollerOf(listRef.value)) startFollowing();
}

// Captured, because a scroll does not bubble and the picker does not choose what
// it stands in: the onboarding's page or a dialog.
const CAPTURED = { capture: true, passive: true };

onMounted(() => {
    void load();
    window.addEventListener('scroll', followScroll, CAPTURED);
    window.addEventListener('wheel', startFollowing, CAPTURED);
    window.addEventListener('touchmove', startFollowing, CAPTURED);
    window.addEventListener('pointerdown', onPointerDown, CAPTURED);
});

onBeforeUnmount(() => {
    window.removeEventListener('scroll', followScroll, CAPTURED);
    window.removeEventListener('wheel', startFollowing, CAPTURED);
    window.removeEventListener('touchmove', startFollowing, CAPTURED);
    window.removeEventListener('pointerdown', onPointerDown, CAPTURED);
});
</script>
