<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader>
            <template #leading>
                <BackButton default-href="/tabs/bibel" />
            </template>

            <!-- The title is the way to anywhere else in the Bible: it opens
                 the books and chapters, and this book's contents. -->
            <button
                v-if="book"
                ref="titleRef"
                type="button"
                class="-mx-1 flex max-w-full items-center gap-1 rounded-md px-1 text-left transition-colors hover:bg-muted active:bg-muted"
                :aria-label="`${chapterLabel(here)} – Kapitel wählen`"
                aria-haspopup="dialog"
                :aria-expanded="pickerOpen"
                @click="pickerOpen = !pickerOpen"
            >
                <span class="truncate">{{ chapterLabel(here) }}</span>
                <ChevronDown
                    class="size-5 shrink-0 text-muted-foreground transition-transform"
                    :class="{ 'rotate-180': pickerOpen }"
                    aria-hidden="true"
                />
            </button>
            <template v-else>Bibel</template>

            <template #trailing>
                <BibelMenuPopover
                    v-if="book"
                    :scale="bibelScale"
                    :display="bibelDisplay"
                    :parallel="bibelParallel"
                    :keep-screen-awake="keepScreenAwake"
                    :top-verse="topVerse"
                    :top-verse-marked="
                        topVerse !== null && lesezeichenStore.has(here.slug, here.chapter, topVerse)
                    "
                    :chapter-marks="chapterMarks"
                    :can-read-aloud="vorlesen.isSupported && state === 'ready'"
                    :reading="vorlesen.status.value !== 'idle'"
                    @opened="topVerse = verseOnScreen()"
                    @update:scale="preferencesStore.setBibelScale($event)"
                    @update:display="preferencesStore.setBibelDisplay($event.key, $event.value)"
                    @update:parallel="preferencesStore.setBibelParallel($event)"
                    @update:keep-screen-awake="preferencesStore.setKeepScreenAwake($event)"
                    @bookmark="bookmarkTopVerse"
                    @goto="scrollToVerse($event, 'smooth')"
                    @read-aloud="readAloud"
                    @stop-reading="vorlesen.stop()"
                >
                    <template #actions="{ close }">
                        <button
                            type="button"
                            class="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-sm transition-colors hover:bg-muted active:bg-muted"
                            :aria-pressed="chapterRead"
                            @click="
                                close();
                                toggleRead();
                            "
                        >
                            <CircleCheck
                                class="size-4 shrink-0"
                                :class="chapterRead ? 'text-gold' : 'text-muted-foreground'"
                                aria-hidden="true"
                            />
                            {{
                                chapterRead
                                    ? 'Als ungelesen markieren'
                                    : 'Kapitel als gelesen markieren'
                            }}
                        </button>
                    </template>
                </BibelMenuPopover>
            </template>
        </AppPageHeader>

        <BibelChapterPicker v-if="book" v-model:open="pickerOpen" :here="here" :anchor="titleRef" />

        <main
            ref="scrollRef"
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            @touchstart.passive="onTouchStart"
            @touchmove.passive="onTouchMove"
            @touchend.passive="onTouchEnd"
            @touchcancel.passive="swipe = null"
        >
            <div class="page-col pb-12 pt-4">
                <article
                    ref="articleRef"
                    class="bibel-text mx-auto max-w-[36rem] font-hymnal text-foreground"
                    :class="{
                        'md:max-w-none': secondary,
                        'bibel-no-headings': !bibelDisplay.showHeadings,
                        'bibel-no-numbers': !bibelDisplay.showVerseNumbers,
                        'bibel-notes-inline': bibelDisplay.notesInline,
                        'bibel-verse-lines': bibelDisplay.versePerLine,
                    }"
                    :style="{ '--bibel-scale': bibelScale }"
                >
                    <p v-if="book" class="label-micro mb-2 text-gold">{{ book.title }}</p>

                    <div v-if="state === 'loading'" class="flex justify-center py-16">
                        <Spinner size="lg" />
                    </div>

                    <div
                        v-else-if="state === 'failed'"
                        class="my-6 flex items-center gap-2 rounded-lg bg-muted p-6 italic text-muted-foreground"
                    >
                        <WifiOff class="size-5 shrink-0" aria-hidden="true" />
                        <span>
                            Dieses Buch ist noch nicht auf dem Gerät. Mit Internetverbindung einmal
                            öffnen, danach ist es auch offline lesbar.
                        </span>
                    </div>

                    <p v-else-if="state === 'missing'" class="my-6 text-muted-foreground">
                        Dieses Kapitel gibt es nicht.
                    </p>

                    <template v-else>
                        <!-- Luther asked for but not to be had: Menge alone, and
                             a word why, not an error — the chapter is all there. -->
                        <p
                            v-if="parallelGap"
                            class="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
                        >
                            <WifiOff
                                v-if="parallelGap === 'failed'"
                                class="size-4 shrink-0"
                                aria-hidden="true"
                            />
                            <Info v-else class="size-4 shrink-0" aria-hidden="true" />
                            {{
                                parallelGap === 'failed'
                                    ? `Die ${parallelName} ist für dieses Buch nicht auf dem Gerät. Hier steht nur Menge.`
                                    : `Dieses Kapitel hat in der ${parallelName} keine Entsprechung. Hier steht nur Menge.`
                            }}
                        </p>

                        <BibelParallelText
                            v-if="secondary"
                            :slug="here.slug"
                            :chapter="here.chapter"
                            :blocks="blocks"
                            :secondary="secondary"
                            :primary-label="BIBEL_TRANSLATIONS.menge.label"
                            :secondary-label="parallelName"
                            :marked-verse="vorlesen.verse.value ?? markedVerse"
                            :all-notes-open="bibelDisplay.notesInline"
                        />
                        <BibelChapterText
                            v-else
                            :slug="here.slug"
                            :chapter="here.chapter"
                            :blocks="blocks"
                            :marked-verse="vorlesen.verse.value ?? markedVerse"
                            :all-notes-open="bibelDisplay.notesInline"
                        />
                    </template>
                </article>

                <BibelReadToggle v-if="state === 'ready'" v-bind="here" />
                <!-- Turning the page: across book boundaries too, so the Bible
                     can be read straight through. -->
                <nav
                    v-if="state === 'ready'"
                    class="mx-auto mt-10 flex max-w-[36rem] gap-3 border-t border-border pt-6"
                    aria-label="Kapitel blättern"
                >
                    <RouterLink
                        v-if="around.prev"
                        :to="chapterPath(around.prev)"
                        class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted active:bg-muted"
                    >
                        <ChevronLeft
                            class="size-5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <span class="truncate">{{ chapterLabel(around.prev) }}</span>
                    </RouterLink>
                    <span v-else class="flex-1" />
                    <RouterLink
                        v-if="around.next"
                        :to="chapterPath(around.next)"
                        class="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-lg border border-border px-3 py-3 text-right transition-colors hover:bg-muted active:bg-muted"
                    >
                        <span class="truncate">{{ chapterLabel(around.next) }}</span>
                        <ChevronRight
                            class="size-5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                    </RouterLink>
                    <span v-else class="flex-1" />
                </nav>
                <BibelChapterSongs
                    v-if="state === 'ready'"
                    :slug="here.slug"
                    :chapter="here.chapter"
                />

                <p class="mx-auto mt-6 max-w-[36rem] text-xs text-muted-foreground">
                    {{ secondary ? `${BIBEL_TRANSLATION} und ${parallelName}` : BIBEL_TRANSLATION }}
                    · Auf den Text tippen wählt Verse aus, auf eine Versnummer tippen setzt ein
                    Lesezeichen. Zum Blättern seitlich wischen.
                </p>
            </div>
        </main>

        <!-- While the voice reads: where it is, and the means to hold it or
             send it away, without going back into the menu. -->
        <div
            v-if="vorlesen.status.value !== 'idle'"
            class="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
            role="region"
            aria-label="Vorlesen"
        >
            <div class="page-col flex h-14 items-center gap-2">
                <Volume2 class="size-5 shrink-0 text-gold" aria-hidden="true" />
                <span class="min-w-0 flex-1 truncate text-sm" aria-live="polite">
                    {{ readingLabel }}
                </span>
                <Button
                    v-if="vorlesen.status.value === 'speaking'"
                    variant="ghost"
                    size="icon"
                    aria-label="Vorlesen anhalten"
                    @click="vorlesen.pause()"
                >
                    <Pause class="!size-5" aria-hidden="true" />
                </Button>
                <Button
                    v-else
                    variant="ghost"
                    size="icon"
                    aria-label="Vorlesen fortsetzen"
                    @click="vorlesen.resume()"
                >
                    <Play class="!size-5" aria-hidden="true" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Vorlesen beenden"
                    @click="vorlesen.stop()"
                >
                    <X class="!size-5" aria-hidden="true" />
                </Button>
            </div>
        </div>
        <BibelVerseActions v-slot="{ here: at, verses, label, done }">
            <BibelVerseServiceActions :here="at" :verses="verses" :label="label" :done="done" />
        </BibelVerseActions>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';

import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    Info,
    Pause,
    Play,
    Volume2,
    WifiOff,
    X,
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useBibelFortschrittStore } from '@/stores/bibelFortschritt';
import { useLeseplanStore } from '@/stores/leseplan';
import { useLesezeichenStore } from '@/stores/lesezeichen';
import { usePreferencesStore } from '@/stores/preferences';

import { useWakeLock } from '@/composables/useWakeLock';

import BibelChapterPicker from '@/components/bibel/BibelChapterPicker.vue';
import BibelChapterSongs from '@/components/bibel/BibelChapterSongs.vue';
import BibelChapterText from '@/components/bibel/BibelChapterText.vue';
import BibelMenuPopover from '@/components/bibel/BibelMenuPopover.vue';
import BibelParallelText from '@/components/bibel/BibelParallelText.vue';
import BibelReadToggle from '@/components/bibel/BibelReadToggle.vue';
import BibelVerseActions from '@/components/bibel/BibelVerseActions.vue';
import BibelVerseServiceActions from '@/components/bibel/BibelVerseServiceActions.vue';
import { readAloudQueue, swipeTurn, verseAtTop } from '@/components/bibel/bibelReader';
import { useVorlesen } from '@/components/bibel/useVorlesen';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import type { BibelParallel } from '@/db';
import {
    BIBEL_TRANSLATION,
    BIBEL_TRANSLATIONS,
    type BibelTranslationId,
    type Block,
    type ChapterRef,
    chapterLabel,
    chapterPath,
    findBook,
    loadBook,
    neighbours,
    setLastRead,
    verseRefLabel,
} from '@/utils/bibel';
import { layoutChapter, snippet, verseText, versesOf } from '@/utils/bibelLayout';
import { type SecondaryVerse, secondaryVerses } from '@/utils/bibelParallel';

const route = useRoute();
const router = useRouter();
const preferencesStore = usePreferencesStore();
const { bibelScale, bibelDisplay, bibelParallel, keepScreenAwake } = storeToRefs(preferencesStore);
const lesezeichenStore = useLesezeichenStore();

// --- Gelesen, from the menu ---------------------------------------------------
//
// The same mark as the toggle at the chapter's end. The plan store is created
// here as well, so a chapter marked from the menu still ticks off the day of a
// reading plan when the Bibel tab has not been opened yet.
const fortschrittStore = useBibelFortschrittStore();
useLeseplanStore();

const chapterRead = computed(() => fortschrittStore.isRead(here.value.slug, here.value.chapter));

async function toggleRead() {
    try {
        const read = await fortschrittStore.toggle(here.value.slug, here.value.chapter);
        toast.success(read ? 'Als gelesen markiert' : 'Als ungelesen markiert', {
            duration: 2000,
        });
    } catch (err) {
        console.error('Error saving the read mark:', err);
        toast.error('Die Markierung konnte nicht gespeichert werden.');
    }
}

const scrollRef = ref<HTMLElement | null>(null);
const articleRef = ref<HTMLElement | null>(null);

const here = computed<ChapterRef>(() => ({
    slug: String(route.params.buch ?? ''),
    chapter: Number(route.params.kapitel) || 1,
}));
const book = computed(() => findBook(here.value.slug));
const around = computed(() => neighbours(here.value.slug, here.value.chapter));

/** The verse a link pointed at (?vers=), marked until the reader moves on. */
const markedVerse = computed(() => Number(route.query.vers) || null);

const state = ref<'loading' | 'ready' | 'failed' | 'missing'>('loading');
const blocks = ref<Block[]>([]);
const laid = computed(() => layoutChapter(blocks.value));

// --- A second translation beside Menge ------------------------------------------

/** Luther's verses for this chapter, by Menge's number; null shows Menge alone. */
const secondary = shallowRef<Map<number, SecondaryVerse> | null>(null);
/** Why Luther was asked for and is not there: offline, or no such chapter. */
const parallelGap = ref<'failed' | 'missing' | null>(null);
const parallelName = computed(() =>
    bibelParallel.value ? BIBEL_TRANSLATIONS[bibelParallel.value].label : '',
);

/** The second book, or null when it cannot be had — never an error on the page. */
async function loadSecondary(slug: string, translation: BibelTranslationId) {
    try {
        return await loadBook(slug, translation);
    } catch (err) {
        console.warn('The parallel translation is not available:', err);
        return null;
    }
}

function setSecondary(translation: BibelParallel, other: Block[][] | null) {
    if (!translation) {
        secondary.value = null;
        parallelGap.value = null;
        return;
    }
    secondary.value = other
        ? secondaryVerses(other, here.value.chapter, versesOf(laid.value))
        : null;
    parallelGap.value = secondary.value ? null : other ? 'missing' : 'failed';
}

// Switched on or off from the menu: Menge stays where it is, Luther joins it.
watch(bibelParallel, async (translation) => {
    if (state.value !== 'ready') return;
    const { slug, chapter } = here.value;
    const other = translation ? await loadSecondary(slug, translation) : null;
    if (slug !== here.value.slug || chapter !== here.value.chapter) return;
    if (translation !== bibelParallel.value) return;
    setSecondary(translation, other);
});

async function load() {
    const { slug, chapter } = here.value;
    if (!book.value || chapter < 1 || chapter > book.value.chapters) {
        state.value = 'missing';
        return;
    }

    state.value = 'loading';
    // Luther is fetched alongside Menge rather than after it, so the page
    // opens once, already in columns.
    const translation = bibelParallel.value;
    const besides = translation ? loadSecondary(slug, translation) : Promise.resolve(null);
    try {
        const chapters = await loadBook(slug);
        const other = await besides;
        // The reader may have turned on while the book was loading.
        if (slug !== here.value.slug || chapter !== here.value.chapter) return;
        blocks.value = chapters[chapter - 1] ?? [];
        setSecondary(translation, other);
        state.value = 'ready';
        setLastRead({ slug, chapter }).catch((err) =>
            console.error('Error saving the Bible position:', err),
        );
    } catch (err) {
        console.error('Error loading the Bible text:', err);
        state.value = 'failed';
        return;
    }

    await nextTick();
    if (!markedVerse.value || !scrollToVerse(markedVerse.value)) {
        scrollRef.value?.scrollTo({ top: 0 });
    }
}

watch(() => [here.value.slug, here.value.chapter], load, { immediate: true });

// A link to another verse of the chapter already open — a section from the
// Inhalt — changes only the query, so the page stays and has to move itself.
watch(markedVerse, async (verse) => {
    if (!verse || state.value !== 'ready') return;
    await nextTick();
    scrollToVerse(verse, 'smooth');
});

function verseElement(verse: number): HTMLElement | null {
    return articleRef.value?.querySelector<HTMLElement>(`#vers-${verse}`) ?? null;
}

/** Bring a verse to the middle of the screen; false when there is no such verse. */
function scrollToVerse(verse: number, behavior: 'auto' | 'smooth' = 'auto'): boolean {
    const target = verseElement(verse);
    target?.scrollIntoView({ block: 'center', behavior });
    return !!target;
}

// --- The verse on screen ---------------------------------------------------------

/** Asked for each time the menu opens: the reader may have scrolled since. */
const topVerse = ref<number | null>(null);

/** The verse being read at the top of the view, from the verse numbers' places. */
function verseOnScreen(): number | null {
    const view = scrollRef.value;
    const article = articleRef.value;
    if (!view || !article || state.value !== 'ready') return null;
    const positions = [...article.querySelectorAll<HTMLElement>('[id^="vers-"]')].map((el) => ({
        verse: Number(el.id.slice('vers-'.length)),
        top: el.getBoundingClientRect().top,
    }));
    // A number within a line of the top edge already counts as there.
    const line = parseFloat(getComputedStyle(article).fontSize) * 1.6;
    return verseAtTop(positions, view.getBoundingClientRect().top, line);
}

// --- Lesezeichen -------------------------------------------------------------------

const chapterMarks = computed(() =>
    lesezeichenStore.lesezeichen
        .filter((mark) => mark.slug === here.value.slug && mark.chapter === here.value.chapter)
        .map((mark) => mark.verse)
        .sort((a, b) => a - b),
);

async function bookmarkTopVerse() {
    const verse = topVerse.value ?? verseOnScreen();
    if (verse === null) return;
    const { slug, chapter } = here.value;
    const label = verseRefLabel({ slug, chapter }, verse);
    try {
        const set = await lesezeichenStore.toggle(
            slug,
            chapter,
            verse,
            snippet(verseText(laid.value, verse)),
        );
        toast.success(set ? `Lesezeichen gesetzt: ${label}` : `Lesezeichen entfernt: ${label}`, {
            duration: 2000,
        });
    } catch (err) {
        console.error('Error saving the Lesezeichen:', err);
        toast.error('Das Lesezeichen konnte nicht gespeichert werden.');
    }
}

// --- Vorlesen ------------------------------------------------------------------------

const vorlesen = useVorlesen();

function readAloud() {
    vorlesen.start(readAloudQueue(laid.value, topVerse.value ?? verseOnScreen()));
}

const readingLabel = computed(() => {
    const verse = vorlesen.verse.value;
    const where = verse ? verseRefLabel(here.value, verse) : chapterLabel(here.value);
    return vorlesen.status.value === 'paused' ? `Angehalten · ${where}` : `Liest ${where}`;
});

// Keep the verse being read in sight, but only move the page when it is about
// to leave the comfortable middle of the screen — moving at every verse would
// make the text impossible to follow by eye.
watch(
    () => vorlesen.verse.value,
    async (verse) => {
        if (!verse) return;
        await nextTick();
        const view = scrollRef.value;
        const target = verseElement(verse);
        if (!view || !target) return;
        const bounds = view.getBoundingClientRect();
        const { top } = target.getBoundingClientRect();
        if (top < bounds.top + bounds.height * 0.1 || top > bounds.bottom - bounds.height * 0.35) {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    },
);

// The voice reads this chapter, not whichever one the reader turns to.
watch(() => [here.value.slug, here.value.chapter], vorlesen.stop);

// --- Bildschirm anlassen -----------------------------------------------------------

// The song page's setting: one screen, one answer to whether it may dim. While
// the voice reads, the screen stays on regardless — a phone that locks itself
// mid-chapter stops the voice with it on most devices.
useWakeLock(() => keepScreenAwake.value || vorlesen.status.value === 'speaking');

// --- Kapitel wählen -------------------------------------------------------------------

const pickerOpen = ref(false);
const titleRef = ref<HTMLElement | null>(null);

// --- Swipe ----------------------------------------------------------------------------

/** The gesture under way, or null once it is clearly not a page turn. */
const swipe = ref<{ x: number; y: number; at: number } | null>(null);

function onTouchStart(event: TouchEvent) {
    // A second finger is a pinch, never a turn.
    if (event.touches.length !== 1) {
        swipe.value = null;
        return;
    }
    const touch = event.touches[0];
    swipe.value = { x: touch.clientX, y: touch.clientY, at: event.timeStamp };
}

function onTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) swipe.value = null;
}

function onTouchEnd(event: TouchEvent) {
    const start = swipe.value;
    swipe.value = null;
    if (!start || state.value !== 'ready') return;
    // A stroke that ends with words selected was the reader selecting them.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;

    const touch = event.changedTouches[0];
    const turn = swipeTurn({
        startX: start.x,
        dx: touch.clientX - start.x,
        dy: touch.clientY - start.y,
        ms: event.timeStamp - start.at,
        width: window.innerWidth,
    });
    const target = turn && around.value[turn];
    if (target) router.push(chapterPath(target));
}
</script>

<style scoped>
/* The Bible's own reading size (the menu's Textgröße). Until the reader sets
   it, it follows the song page's Größe — see the preferences store. */
.bibel-text {
    font-size: calc(1.0625rem * var(--bibel-scale, 1));
    line-height: 1.6;
}

/* The display switches act on the text from out here, so the text keeps one
   way of setting a chapter and the page decides what to leave out. */

.bibel-no-headings :deep(.bibel-heading) {
    display: none;
}

/* Hidden numbers keep their place in the line at no width: they are still
   what the page measures to find the verse on screen and to scroll to one.
   A verse marked with a Lesezeichen keeps its gold tab — the mark is the
   reader's own, not part of the apparatus being hidden. */
.bibel-no-numbers :deep(.bibel-verse:not(.bibel-verse-set)) {
    padding: 0;
    margin: 0;
    font-size: 0;
    pointer-events: none;
}

/* Luther's numbers beside Menge's go with them; nothing measures these. */
.bibel-no-numbers :deep(.bibel-secondary-verse) {
    display: none;
}

/* Every note open in the line; the marker that opens it has nothing to do. */
.bibel-notes-inline :deep(.bibel-note-mark) {
    display: none;
}

/* Prose verses each on a line of their own, as in a study edition. Poetry
   keeps Menge's lines either way. */
.bibel-verse-lines :deep(.bibel-para:not(.bibel-poetry) .bibel-line) {
    display: block;
    margin-bottom: 0.25em;
}
</style>
