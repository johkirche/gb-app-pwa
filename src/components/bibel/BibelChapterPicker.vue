<template>
    <ResponsivePanel
        v-model:open="open"
        :anchor="anchor"
        label="Kapitel wählen"
        align="start"
        popover-class="w-96"
        drawer-class="h-full max-h-[92dvh]"
    >
        <div class="sticky top-0 z-20 bg-popover px-4 pb-3 pt-1">
            <div class="flex items-center justify-between gap-2">
                <PanelTitle>{{ book?.name ?? 'Bibel' }}</PanelTitle>
            </div>
            <ToggleGroup
                type="single"
                class="mt-3 flex w-full"
                aria-label="Ansicht"
                :model-value="view"
                @update:model-value="onView"
            >
                <ToggleGroupItem value="buecher" class="flex-1">Bücher</ToggleGroupItem>
                <ToggleGroupItem value="inhalt" class="flex-1">Inhalt</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <!-- The canon, with the open book's chapters laid out under it — the
             same list as the Bibel tab, so the reader finds things where they
             already know them to be. -->
        <div v-if="view === 'buecher'" ref="listRef" class="px-4 pb-6">
            <section v-for="testament in testaments" :key="testament.key">
                <h3 class="label-micro mb-1 mt-3 text-gold">{{ testament.label }}</h3>
                <ul class="divide-y divide-border">
                    <!-- scroll-mt: clear of the sticky header when opened at it. -->
                    <li
                        v-for="entry in testament.books"
                        :key="entry.slug"
                        :data-book="entry.slug"
                        class="scroll-mt-28"
                    >
                        <button
                            type="button"
                            class="flex w-full items-center gap-3 rounded-sm px-1 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                            :aria-expanded="
                                entry.chapters > 1 ? openBook === entry.slug : undefined
                            "
                            @click="onBook(entry)"
                        >
                            <span
                                class="min-w-0 flex-1 truncate text-[15px] leading-tight"
                                :class="
                                    entry.slug === here.slug
                                        ? 'font-semibold text-gold'
                                        : 'font-medium'
                                "
                            >
                                {{ entry.name }}
                            </span>
                            <span class="shrink-0 text-sm text-muted-foreground">
                                {{ entry.chapters }} Kap.
                            </span>
                            <ChevronRight
                                class="size-[18px] shrink-0 text-muted-foreground transition-transform"
                                :class="{ 'rotate-90': openBook === entry.slug }"
                                aria-hidden="true"
                            />
                        </button>

                        <nav
                            v-if="openBook === entry.slug"
                            class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 px-1 pb-3 pt-1"
                            :aria-label="`Kapitel von ${entry.name}`"
                        >
                            <RouterLink
                                v-for="n in entry.chapters"
                                :key="n"
                                :to="chapterPath({ slug: entry.slug, chapter: n })"
                                class="flex h-11 items-center justify-center rounded-md border text-[15px] transition-colors hover:border-primary/40 hover:bg-muted active:bg-muted"
                                :class="
                                    isHere(entry.slug, n)
                                        ? 'border-gold bg-gold/10 font-semibold'
                                        : 'border-border'
                                "
                                :aria-current="isHere(entry.slug, n) ? 'page' : undefined"
                                @click="open = false"
                            >
                                {{ n }}
                            </RouterLink>
                        </nav>
                    </li>
                </ul>
            </section>
        </div>

        <!-- Inhalt: Menge's divisions and sections of this book, each with
             where it starts, so a story can be found by what it is called. -->
        <div v-else class="px-4 pb-6">
            <div v-if="contentsState === 'loading'" class="flex justify-center py-12">
                <Spinner size="lg" />
            </div>
            <p
                v-else-if="contentsState === 'failed'"
                class="flex items-center gap-2 py-6 text-sm italic text-muted-foreground"
            >
                <WifiOff class="size-4 shrink-0" aria-hidden="true" />
                Das Inhaltsverzeichnis braucht dieses Buch auf dem Gerät.
            </p>
            <p v-else-if="contents.length === 0" class="py-6 text-sm text-muted-foreground">
                Dieses Buch hat keine Überschriften.
            </p>
            <ul v-else ref="contentsRef">
                <li v-for="(entry, i) in contents" :key="i">
                    <RouterLink
                        :to="chapterPath({ slug: here.slug, chapter: entry.chapter }, entry.verse)"
                        class="flex items-baseline gap-3 rounded-sm px-1 transition-colors hover:bg-muted active:bg-muted"
                        :class="
                            entry.level === 2
                                ? 'mt-3 py-1.5 font-display text-base font-semibold'
                                : 'py-2 pl-3 text-[15px]'
                        "
                        :data-here="entry.chapter === here.chapter || undefined"
                        @click="open = false"
                    >
                        <span class="min-w-0 flex-1">{{ entry.text }}</span>
                        <span
                            class="number-display shrink-0 text-sm"
                            :class="
                                entry.chapter === here.chapter
                                    ? 'text-gold'
                                    : 'text-muted-foreground'
                            "
                        >
                            {{ placeLabel(entry) }}
                        </span>
                    </RouterLink>
                </li>
            </ul>
        </div>
    </ResponsivePanel>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { ChevronRight, WifiOff } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { RouterLink, useRouter } from 'vue-router';

import { PanelTitle, ResponsivePanel } from '@/components/ui/responsive-panel';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import type { PanelAnchor } from '@/lib/anchor';
import {
    BIBEL_BOOKS,
    type BibelBook,
    type ChapterRef,
    chapterPath,
    findBook,
    loadBook,
} from '@/utils/bibel';

import { type ContentsEntry, bookContents } from './bibelReader';

/**
 * Jumping without going back to the tab: every book and its chapters, and the
 * open book's own table of contents.
 */
const props = defineProps<{
    here: ChapterRef;
    /** What the desktop popover opens against — the title that opened it. */
    anchor?: PanelAnchor;
}>();

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();

const book = computed(() => findBook(props.here.slug));

const testaments = (['AT', 'NT'] as const).map((key) => ({
    key,
    label: key === 'AT' ? 'Altes Testament' : 'Neues Testament',
    books: BIBEL_BOOKS.filter((entry) => entry.testament === key),
}));

const view = ref<'buecher' | 'inhalt'>('buecher');
const openBook = ref<string | null>(null);
const listRef = ref<HTMLElement | null>(null);
const contentsRef = ref<HTMLElement | null>(null);

function isHere(slug: string, chapter: number): boolean {
    return slug === props.here.slug && chapter === props.here.chapter;
}

function onBook(entry: BibelBook) {
    if (entry.chapters === 1) {
        open.value = false;
        router.push(chapterPath({ slug: entry.slug, chapter: 1 }));
        return;
    }
    openBook.value = openBook.value === entry.slug ? null : entry.slug;
}

function onView(value: AcceptableValue | AcceptableValue[]) {
    if (value === 'buecher' || value === 'inhalt') view.value = value;
}

// Every opening starts at the book being read, its chapters laid out: the
// next chapter but one is the likeliest jump, and 66 books are a long way to
// scroll to find it.
watch(open, async (isOpen) => {
    if (!isOpen) return;
    view.value = 'buecher';
    openBook.value = props.here.slug;
    await nextTick();
    // The panel animates in; give it a frame to have a size to scroll.
    requestAnimationFrame(() => {
        listRef.value
            ?.querySelector(`[data-book="${props.here.slug}"]`)
            ?.scrollIntoView({ block: 'start' });
    });
});

// --- Inhalt ----------------------------------------------------------------------

const contents = ref<ContentsEntry[]>([]);
const contentsState = ref<'loading' | 'ready' | 'failed'>('loading');
let contentsOf = '';

async function loadContents() {
    const slug = props.here.slug;
    if (contentsOf === slug && contentsState.value === 'ready') return;
    contentsState.value = 'loading';
    try {
        // The page has the book already, so this is the cached promise.
        const chapters = await loadBook(slug);
        if (slug !== props.here.slug) return;
        contents.value = bookContents(chapters);
        contentsOf = slug;
        contentsState.value = 'ready';
    } catch (err) {
        console.error('Error loading the table of contents:', err);
        contentsState.value = 'failed';
    }
}

watch(view, async (current) => {
    if (current !== 'inhalt') return;
    await loadContents();
    await nextTick();
    // Open at the section being read rather than at the book's start.
    contentsRef.value?.querySelector('[data-here]')?.scrollIntoView({ block: 'center' });
});

/** "Kap. 3", or "3,9" when the section starts inside the chapter. */
function placeLabel(entry: ContentsEntry): string {
    if ((book.value?.chapters ?? 0) <= 1) return entry.verse ? `V. ${entry.verse}` : '';
    return entry.verse ? `${entry.chapter},${entry.verse}` : `Kap. ${entry.chapter}`;
}
</script>
