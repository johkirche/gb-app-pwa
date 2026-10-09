<template>
    <!-- Two ways to reorder. In the reorder mode, by the grips, at once. Out
         of it, by holding a row until it lifts and then moving it — and a
         row held and let go without moving opens its menu instead, which is
         what holding a row has always done here. A mouse drags at once: the
         delay is a finger's alone, so a scroll is never mistaken for a drag. -->
    <VueDraggable
        :model-value="rows"
        tag="ol"
        class="mt-2 divide-y divide-border"
        :handle="reorderMode ? '[data-drag-handle]' : undefined"
        :delay="reorderMode ? 0 : HOLD_TO_LIFT_MS"
        :delay-on-touch-only="true"
        :touch-start-threshold="5"
        chosen-class="service-row-lifted"
        ghost-class="opacity-40"
        :animation="150"
        @update:model-value="handleReorder"
        @pointerdown.capture="pointerType = $event.pointerType"
        @click.capture="swallowClickAfterHold"
        @choose="handleChoose"
        @start="held && (held.moved = true)"
        @unchoose="handleUnchoose"
    >
        <!-- The row is the wrapper, not the button: the `⋯` menu trigger has to
             sit beside whatever opens the song, never inside it. -->
        <li
            v-for="row in rows"
            :key="row.key"
            class="group flex items-center pr-2"
            :class="
                reorderMode ? '' : 'rounded-sm transition-colors hover:bg-muted active:bg-muted'
            "
            @contextmenu="row.kind === 'song' && handleContextMenu($event, row.song)"
        >
            <!-- A song -->
            <template v-if="row.kind === 'song'">
                <component
                    :is="reorderMode ? 'div' : 'button'"
                    :type="reorderMode ? undefined : 'button'"
                    class="flex min-w-0 flex-1 select-none items-center gap-4 py-3 pl-2 text-left [-webkit-touch-callout:none]"
                    @click="handleClick(row.song)"
                >
                    <!-- Which song of the service this is — the readings between
                         do not count, the second hymn is the second hymn. Not the
                         hymn number either: that one stays with the title,
                         where it is read out from. -->
                    <span
                        class="number-display flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-[0.8125rem] leading-none text-muted-foreground"
                        aria-hidden="true"
                    >
                        {{ songNumbers[row.key] }}
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block break-words font-display text-[1.0625rem] leading-snug">
                            <span v-if="row.song.index" class="number-display mr-0.5 text-lg">
                                {{ row.song.index }}.
                            </span>
                            <span>{{ row.song.titel }}</span>
                        </span>
                        <!-- Which verses this service sings, where that was
                             narrowed down. The whole hymn says nothing: a line
                             under every row would only be noise. -->
                        <span
                            v-if="verseLabels?.[row.song.id]"
                            class="label-micro mt-0.5 block text-gold"
                        >
                            {{ verseLabels[row.song.id] }}
                        </span>
                        <span
                            v-else-if="formatCategories(row.song.kategorien)"
                            class="label-micro mt-0.5 block text-muted-foreground"
                        >
                            {{ formatCategories(row.song.kategorien) }}
                        </span>
                    </span>
                    <DragHandle v-if="reorderMode" />
                </component>

                <!-- Reordering has its own grip in that slot. -->
                <RowActionsTrigger
                    v-if="!reorderMode"
                    :label="`Aktionen für ${row.song.titel}`"
                    :active="activeSongId === row.song.id"
                    @open="emit('songContextMenu', row.song, $event)"
                />
            </template>

            <!-- A reading -->
            <template v-else>
                <component
                    :is="reorderMode ? 'div' : RouterLink"
                    :to="reorderMode ? undefined : passagePath(row.passage)"
                    class="flex min-w-0 flex-1 select-none items-center gap-4 py-3 pl-2 [-webkit-touch-callout:none]"
                >
                    <!-- In the slot the songs number themselves in, so the two
                         kinds of row line up and tell themselves apart. -->
                    <span
                        class="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold"
                        aria-hidden="true"
                    >
                        <BookOpen class="size-[0.9375rem]" />
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block break-words font-display text-[1.0625rem] leading-snug">
                            {{ passageLabel(row.passage) }}
                        </span>
                        <span
                            v-if="snippets[passageKey(row.passage)]"
                            class="mt-0.5 line-clamp-2 text-sm text-muted-foreground"
                        >
                            {{ snippets[passageKey(row.passage)] }}
                        </span>
                        <span v-else class="label-micro mt-0.5 block text-muted-foreground">
                            Lesung
                        </span>
                    </span>
                    <DragHandle v-if="reorderMode" />
                </component>
                <Button
                    v-if="!reorderMode"
                    variant="ghost"
                    size="icon"
                    class="shrink-0"
                    :aria-label="`${passageLabel(row.passage)} entfernen`"
                    @click="emit('removeLesung', passageKey(row.passage))"
                >
                    <X class="!size-[1.125rem] text-muted-foreground" aria-hidden="true" />
                </Button>
            </template>
        </li>
    </VueDraggable>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue';

import { BookOpen, GripVertical, X } from 'lucide-vue-next';
import { VueDraggable } from 'vue-draggable-plus';
import { RouterLink } from 'vue-router';

import { usePassageSnippets } from '@/composables/usePassageSnippets';

import { Button } from '@/components/ui/button';
import { RowActionsTrigger } from '@/components/ui/responsive-panel';

import type { BibelPassage, Category, Song } from '@/db';
import { type PanelAnchor, anchorFromEvent } from '@/lib/anchor';
import { passageKey, passageLabel, passagePath } from '@/utils/bibelPassage';

/**
 * One row of the service: a song resolved to its record, or a reading. `key`
 * is the plan's item key (`ServiceItem.key`), which is what a reorder hands back.
 */
export type ServiceRow =
    | { kind: 'song'; key: string; song: Song }
    | { kind: 'lesung'; key: string; passage: BibelPassage };

const props = defineProps<{
    rows: ServiceRow[];
    reorderMode: boolean;
    /**
     * Per song id, the verses this service sings („Strophen 1–3 und 5") — only
     * for the songs where a choice was actually made. Passed in already
     * phrased: the row renders what the plan says, it does not read the plan.
     */
    verseLabels?: Record<string, string>;
    /** The song whose menu is open, so its `⋯` stays lit while it is. */
    activeSongId?: string | null;
}>();

const emit = defineEmits<{
    songClick: [song: Song];
    /** The anchor is the row (or click point) the desktop popover opens against. */
    songContextMenu: [song: Song, anchor: PanelAnchor];
    /** The passageKey of the reading to take off. */
    removeLesung: [key: string];
    /** Every rendered row's key, in the new order, after a drop. */
    reorder: [keys: string[]];
}>();

const DragHandle = () =>
    h(
        'span',
        {
            'data-drag-handle': '',
            class: 'flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing',
        },
        [h(GripVertical, { class: 'size-5', 'aria-hidden': 'true' })],
    );

const songNumbers = computed(() => {
    const numbers: Record<string, number> = {};
    let count = 0;
    for (const row of props.rows) if (row.kind === 'song') numbers[row.key] = ++count;
    return numbers;
});

const snippets = usePassageSnippets(() =>
    props.rows.flatMap((row) => (row.kind === 'lesung' ? [row.passage] : [])),
);

function handleClick(song: Song) {
    if (!props.reorderMode) emit('songClick', song);
}

function handleContextMenu(event: MouseEvent, song: Song) {
    event.preventDefault();
    // Android sends one for a held finger too — but a held finger is about to
    // lift the row, and the menu waits for it to be let go (handleUnchoose).
    if (pointerType.value === 'touch') return;
    if (!props.reorderMode) emit('songContextMenu', song, anchorFromEvent(event));
}

// --- Hold to lift ---

/** As long as the long press elsewhere in the app, so the hold feels the same. */
const HOLD_TO_LIFT_MS = 500;

/** How the last press came in — Sortable's own events do not say. */
const pointerType = ref('');

/** The row a finger is holding, from the moment it lifts until it is let go. */
const held = ref<{ row: ServiceRow; el: HTMLElement; moved: boolean } | null>(null);
let swallowClick = false;

function handleChoose(event: { oldIndex?: number; item: HTMLElement }) {
    // A mouse is chosen on mousedown, before anyone has held anything.
    if (props.reorderMode || pointerType.value !== 'touch') return;
    const row = props.rows[event.oldIndex ?? -1];
    if (!row) return;
    held.value = { row, el: event.item, moved: false };
    if ('vibrate' in navigator) navigator.vibrate(50);
}

function handleUnchoose() {
    const hold = held.value;
    held.value = null;
    if (!hold) return;

    // Whatever happens next, the finger coming up was not a tap on the row.
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 400);

    // Held and let go where it was: the row's menu, as the long press always was.
    if (!hold.moved && hold.row.kind === 'song') {
        emit('songContextMenu', hold.row.song, hold.el);
    }
}

function swallowClickAfterHold(event: MouseEvent) {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
}

function handleReorder(reordered: ServiceRow[]) {
    emit(
        'reorder',
        reordered.map((row) => row.key),
    );
}

function formatCategories(categories: Category[]): string {
    return categories
        .map((c) => c.name?.trim())
        .filter((name): name is string => !!name)
        .join(', ');
}
</script>

<style scoped>
/* The row a held finger has lifted: it comes off the page before it moves. */
:deep(.service-row-lifted) {
    background-color: var(--color-muted);
    box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 0.18);
}
</style>
