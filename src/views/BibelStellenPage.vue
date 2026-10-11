<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Meine Stellen">
            <template #leading>
                <BackButton default-href="/tabs/bibel" />
            </template>
            <template #trailing>
                <Button
                    v-if="selecting || visible.length > 0"
                    variant="ghost"
                    size="sm"
                    @click="setSelecting(!selecting)"
                >
                    {{ selecting ? 'Fertig' : 'Auswählen' }}
                </Button>
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col pb-24 pt-3">
                <p v-if="all.length === 0" class="px-2 text-[0.9375rem] text-muted-foreground">
                    Noch keine Stellen. Im Text auf eine Versnummer tippen, um ein Lesezeichen zu
                    setzen, oder auf einen Vers, um ihn zu markieren und eine Notiz zu schreiben.
                </p>

                <template v-else>
                    <!-- The controls scroll away with the list: on a phone at a
                         large Größe, kept in place they would be half the page. -->
                    <div class="space-y-2">
                        <div
                            class="flex min-w-0 cursor-text items-center gap-2 rounded-lg bg-muted px-3"
                            @click="inputRef?.focus()"
                        >
                            <Search
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <input
                                ref="inputRef"
                                v-model="query"
                                type="search"
                                enterkeyhint="search"
                                autocomplete="off"
                                class="min-w-0 flex-1 bg-transparent py-2 text-[1rem] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                                placeholder="In Stellen und Notizen suchen"
                                aria-label="In Stellen und Notizen suchen"
                            />
                            <Button
                                v-if="query"
                                variant="ghost"
                                size="icon-sm"
                                class="-mr-1.5 shrink-0 text-muted-foreground"
                                aria-label="Suche löschen"
                                @click.stop="query = ''"
                            >
                                <CircleX aria-hidden="true" />
                            </Button>
                        </div>

                        <!-- Four segments share a phone at the resting size; past
                             it, „Markierungen" is one word no engine can be
                             trusted to hyphenate, so the track wraps to a second
                             row instead, each segment as wide as its label. -->
                        <ToggleGroup
                            v-if="arten.length > 2"
                            type="single"
                            :model-value="art"
                            class="w-full flex-wrap"
                            aria-label="Art der Stellen"
                            @update:model-value="onArt"
                        >
                            <ToggleGroupItem
                                v-for="option in arten"
                                :key="option.key"
                                :value="option.key"
                                class="grow px-2 py-1.5"
                            >
                                {{ option.label }}
                            </ToggleGroupItem>
                        </ToggleGroup>

                        <!-- The colours, under Markierungen: "the green ones" is
                             how a reader who colours by theme looks for them. -->
                        <div
                            v-if="art === 'markierungen'"
                            class="flex flex-wrap gap-2"
                            role="group"
                            aria-label="Farbe"
                        >
                            <button
                                v-for="color in MARKIERUNGS_FARBEN"
                                :key="color.key"
                                type="button"
                                class="inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-sm transition-colors"
                                :class="
                                    farbe === color.key
                                        ? 'border-foreground bg-muted font-medium'
                                        : 'border-border text-muted-foreground hover:bg-muted'
                                "
                                :aria-pressed="farbe === color.key"
                                @click="farbe = farbe === color.key ? null : color.key"
                            >
                                <span
                                    class="size-3 shrink-0 rounded-full border border-border"
                                    :style="{ background: `var(--bibel-mark-${color.key})` }"
                                    aria-hidden="true"
                                />
                                {{ color.label }}
                            </button>
                        </div>

                        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                            <p class="px-2 text-sm text-muted-foreground" aria-live="polite">
                                {{ countLabel }}
                            </p>
                            <ToggleGroup
                                type="single"
                                :model-value="ordnung"
                                aria-label="Reihenfolge"
                                @update:model-value="onOrdnung"
                            >
                                <ToggleGroupItem value="buch" class="px-2 py-1">
                                    Nach Buch
                                </ToggleGroupItem>
                                <ToggleGroupItem value="neueste" class="px-2 py-1">
                                    Neueste
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                    </div>

                    <p
                        v-if="visible.length === 0"
                        class="mt-6 px-2 text-[0.9375rem] text-muted-foreground"
                    >
                        Keine Stellen gefunden.
                    </p>

                    <!-- In the Bible's order, under the book's name, which stays
                         in view while its verses scroll under it. -->
                    <template v-else-if="ordnung === 'buch'">
                        <section
                            v-for="group in groups"
                            :key="group.book.slug"
                            class="mt-4"
                            :aria-label="group.book.name"
                        >
                            <h2
                                class="sticky top-0 z-10 flex items-baseline justify-between gap-3 bg-background px-2 py-1.5 font-display text-lg font-semibold"
                            >
                                <span class="min-w-0">{{ group.book.name }}</span>
                                <span
                                    class="shrink-0 font-sans text-sm font-normal text-muted-foreground"
                                >
                                    {{ group.rows.length }}
                                </span>
                            </h2>
                            <ul class="divide-y divide-border">
                                <li v-for="row in group.rows" :key="row.id">
                                    <StellenRow
                                        :stelle="row"
                                        :selecting="selecting"
                                        :selected="selected.has(row.id)"
                                        @toggle="toggle(row.id)"
                                    />
                                </li>
                            </ul>
                        </section>
                    </template>

                    <ul v-else class="mt-4 divide-y divide-border">
                        <li v-for="row in visible" :key="row.id">
                            <StellenRow
                                :stelle="row"
                                :selecting="selecting"
                                :selected="selected.has(row.id)"
                                @toggle="toggle(row.id)"
                            />
                        </li>
                    </ul>
                </template>
            </div>
        </main>

        <!-- While picking: how many, and what is done with them. Below the
             list rather than over it, so the last row can still be reached. -->
        <div v-if="selecting" class="shrink-0 border-t border-border bg-background">
            <!-- The count takes a line of its own when the buttons leave it
                 no room, rather than being squeezed to nothing beside them. -->
            <div class="page-col flex flex-wrap items-center gap-2 py-2.5">
                <p class="grow px-2 text-sm" aria-live="polite">{{ selected.size }} ausgewählt</p>
                <div class="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" @click="toggleAll">
                        {{ allSelected ? 'Keine' : 'Alle' }}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        :disabled="selected.size === 0"
                        @click="removeSelected"
                    >
                        <Trash2 aria-hidden="true" />
                        Entfernen
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { CircleX, Search, Trash2 } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import type { AcceptableValue } from 'reka-ui';
import { useRoute, useRouter } from 'vue-router';

import { useLesezeichenStore } from '@/stores/lesezeichen';
import { useMarkierungenStore } from '@/stores/markierungen';
import { useNotizenStore } from '@/stores/notizen';
import { usePreferencesStore } from '@/stores/preferences';

import { useConfirm } from '@/composables/useConfirm';
import { useStellen } from '@/composables/useStellen';

import StellenRow from '@/components/bibel/BibelStellenRow.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { MarkierungsFarbe } from '@/db';
import {
    MARKIERUNGS_FARBEN,
    type StellenArt,
    type StellenOrdnung,
    clearsOf,
    filterStellen,
    groupByBook,
} from '@/utils/meineStellen';

const route = useRoute();
const router = useRouter();
const { confirm } = useConfirm();
const lesezeichen = useLesezeichenStore();
const markierungen = useMarkierungenStore();
const notizen = useNotizenStore();
const { bibelFeatures } = storeToRefs(usePreferencesStore());

const all = useStellen();

/** The kinds on offer: those whose feature is on, and „Alle" over them. */
const arten = computed(() => {
    const list: { key: StellenArt; label: string }[] = [{ key: 'alle', label: 'Alle' }];
    if (bibelFeatures.value.lesezeichen) list.push({ key: 'lesezeichen', label: 'Lesezeichen' });
    if (bibelFeatures.value.notizen) {
        list.push({ key: 'notizen', label: 'Notizen' });
        list.push({ key: 'markierungen', label: 'Markierungen' });
    }
    return list;
});

// The kind is in the address, so the Bibel tab can link straight to its
// Lesezeichen and the back button returns to the same view.
const art = computed<StellenArt>(() => {
    const value = route.query.art;
    return arten.value.find((a) => a.key === value)?.key ?? 'alle';
});

function onArt(value: AcceptableValue | AcceptableValue[] | undefined) {
    if (typeof value !== 'string' || value === art.value) return;
    const { art: _art, ...query } = route.query;
    router.replace({ query: value === 'alle' ? query : { ...query, art: value } });
}

const farbe = ref<MarkierungsFarbe | null>(null);
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

// The order is the reader's habit, so it is remembered on this device. The
// storage can be missing or refuse (a private window): then it is the default.
const ORDNUNG_KEY = 'bibel-stellen-ordnung';
function readOrdnung(): StellenOrdnung {
    try {
        return localStorage.getItem(ORDNUNG_KEY) === 'neueste' ? 'neueste' : 'buch';
    } catch {
        return 'buch';
    }
}
const ordnung = ref<StellenOrdnung>(readOrdnung());

function onOrdnung(value: AcceptableValue | AcceptableValue[] | undefined) {
    if (value !== 'buch' && value !== 'neueste') return;
    ordnung.value = value;
    try {
        localStorage.setItem(ORDNUNG_KEY, value);
    } catch {
        // Not remembered; the choice still holds while the page is open.
    }
}

const visible = computed(() =>
    filterStellen(all.value, {
        art: art.value,
        farbe: art.value === 'markierungen' ? farbe.value : null,
        query: query.value,
        ordnung: ordnung.value,
    }),
);
const groups = computed(() => groupByBook(visible.value));

const countLabel = computed(() => {
    const n = visible.value.length;
    return n === 1 ? '1 Stelle' : `${n} Stellen`;
});

// --- Picking out and clearing ----------------------------------------------

const selecting = ref(false);
const selected = ref(new Set<string>());

function setSelecting(on: boolean) {
    selecting.value = on;
    selected.value = new Set();
}

function toggle(id: string) {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected.value = next;
}

const allSelected = computed(
    () => visible.value.length > 0 && visible.value.every((row) => selected.value.has(row.id)),
);

function toggleAll() {
    selected.value = allSelected.value ? new Set() : new Set(visible.value.map((row) => row.id));
}

// A row filtered out of view is no longer picked: "Entfernen" acts only on
// what can be seen.
watch(visible, (rows) => {
    const ids = new Set(rows.map((row) => row.id));
    const kept = [...selected.value].filter((id) => ids.has(id));
    if (kept.length !== selected.value.size) selected.value = new Set(kept);
});

const WHAT: Record<StellenArt, string> = {
    alle: 'Lesezeichen, Markierungen und Notizen dieser Verse werden gelöscht.',
    lesezeichen: 'Die Lesezeichen werden gelöscht; Markierungen und Notizen bleiben.',
    notizen: 'Die Notizen werden gelöscht; Lesezeichen und Markierungen bleiben.',
    markierungen: 'Die Markierungen werden gelöscht; Lesezeichen und Notizen bleiben.',
};

async function removeSelected() {
    const rows = visible.value.filter((row) => selected.value.has(row.id));
    if (rows.length === 0) return;
    const confirmed = await confirm({
        title: rows.length === 1 ? '1 Stelle entfernen?' : `${rows.length} Stellen entfernen?`,
        message: WHAT[art.value],
        confirmText: 'Entfernen',
        destructive: true,
    });
    if (!confirmed) return;
    try {
        for (const row of rows) {
            const clears = clearsOf(row, art.value);
            if (clears.lesezeichen) await lesezeichen.remove(row.id);
            if (clears.notiz) await notizen.remove(row.id);
            if (clears.markierung) {
                await markierungen.setColor(row.slug, row.chapter, row.verses, null);
            }
        }
    } catch (err) {
        console.error('Error removing Stellen:', err);
    }
    setSelecting(false);
}
</script>
