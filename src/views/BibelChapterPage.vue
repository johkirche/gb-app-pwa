<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader :title="book ? chapterLabel(here) : 'Bibel'">
            <template #leading>
                <BackButton default-href="/tabs/bibel" />
            </template>
        </AppPageHeader>

        <main ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col pb-12 pt-4">
                <article
                    class="bibel-text mx-auto max-w-[36rem] font-hymnal text-foreground"
                    :style="{ '--bibel-scale': pageScale }"
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
                        <template v-for="(block, b) in rendered" :key="`${here.slug}-${b}`">
                            <!-- Menge's own headings, from the book's main
                                 divisions down to its subsections. -->
                            <component
                                :is="`h${block.level}`"
                                v-if="block.kind === 'heading'"
                                class="bibel-heading font-display font-semibold leading-tight"
                                :class="`bibel-h${block.level}`"
                            >
                                {{ block.text }}
                            </component>

                            <!-- Prose runs its verses together as the page
                                 does; poetry keeps Menge's lines and indents. -->
                            <div
                                v-else
                                class="bibel-para"
                                :class="{ 'bibel-poetry': block.poetry }"
                            >
                                <span
                                    v-for="(line, l) in block.lines"
                                    :key="l"
                                    class="bibel-line"
                                    :style="line.indent ? { '--indent': line.indent } : undefined"
                                >
                                    <template v-for="(seg, s) in line.segments" :key="s">
                                        <!-- The verse number is where a
                                             Lesezeichen is set and taken off. -->
                                        <button
                                            v-if="seg.kind === 'verse'"
                                            :id="`vers-${seg.verse}`"
                                            type="button"
                                            class="bibel-verse number-display"
                                            :class="{ 'bibel-verse-set': isMarked(seg.verse) }"
                                            :aria-pressed="isMarked(seg.verse)"
                                            :aria-label="`Lesezeichen bei Vers ${seg.verse}`"
                                            @click="toggleLesezeichen(seg.verse)"
                                            v-text="seg.verse"
                                        />
                                        <button
                                            v-else-if="seg.kind === 'note'"
                                            type="button"
                                            class="bibel-note-mark"
                                            :aria-expanded="openNotes.has(seg.key)"
                                            aria-label="Anmerkung"
                                            @click="toggleNote(seg.key)"
                                            v-text="'*'"
                                        />
                                        <span
                                            v-else
                                            :class="{
                                                italic: seg.kind === 'italic',
                                                'bibel-marked': seg.verse === markedVerse,
                                            }"
                                            v-text="seg.text"
                                        />
                                        <span
                                            v-if="seg.kind === 'note' && openNotes.has(seg.key)"
                                            class="bibel-note"
                                            v-text="` (${seg.text})`"
                                        />
                                    </template>
                                </span>
                            </div>
                        </template>
                    </template>
                </article>

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

                <p class="mx-auto mt-6 max-w-[36rem] text-xs text-muted-foreground">
                    {{ BIBEL_TRANSLATION }} · Auf eine Versnummer tippen setzt ein Lesezeichen.
                </p>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { ChevronLeft, ChevronRight, WifiOff } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { RouterLink, useRoute } from 'vue-router';
import { toast } from 'vue-sonner';

import { useLesezeichenStore } from '@/stores/lesezeichen';
import { usePreferencesStore } from '@/stores/preferences';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Spinner } from '@/components/ui/spinner';

import {
    BIBEL_TRANSLATION,
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

const route = useRoute();
const { pageScale } = storeToRefs(usePreferencesStore());

const scrollRef = ref<HTMLElement | null>(null);

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

// --- The chapter, laid out for the template ------------------------------
//
// Each run of text carries the verse it belongs to, so a verse that runs over
// several poetry lines can be marked as a whole.

type Seg =
    | { kind: 'verse'; verse: number }
    | { kind: 'text' | 'italic'; text: string; verse: number | null }
    | { kind: 'note'; text: string; key: string; verse: number | null };

type Rendered =
    | { kind: 'heading'; level: number; text: string }
    | { kind: 'para'; poetry: boolean; lines: { indent: number; segments: Seg[] }[] };

const rendered = computed<Rendered[]>(() => {
    let verse: number | null = null;
    return blocks.value.map((block, b) => {
        if ('h' in block) return { kind: 'heading', level: block.h, text: block.t };
        return {
            kind: 'para',
            poetry: !!block.q,
            lines: block.p.map((line, l) => ({
                indent: line.i ?? 0,
                segments: line.s.map((seg, s): Seg => {
                    if (typeof seg === 'string') return { kind: 'text', text: seg, verse };
                    if ('v' in seg) {
                        verse = seg.v;
                        return { kind: 'verse', verse: seg.v };
                    }
                    if ('e' in seg) return { kind: 'italic', text: seg.e, verse };
                    return { kind: 'note', text: seg.n, key: `${b}.${l}.${s}`, verse };
                }),
            })),
        };
    });
});

const openNotes = ref(new Set<string>());

function toggleNote(key: string) {
    const next = new Set(openNotes.value);
    if (!next.delete(key)) next.add(key);
    openNotes.value = next;
}

// --- Lesezeichen ------------------------------------------------------------

const lesezeichenStore = useLesezeichenStore();

function isMarked(verse: number): boolean {
    return lesezeichenStore.has(here.value.slug, here.value.chapter, verse);
}

/** The verse's opening words, for the list on the Bibel tab. */
function snippetOf(verse: number): string {
    // Runs within a line meet as written; lines meet with a space.
    const text = rendered.value
        .flatMap((block) => (block.kind === 'para' ? block.lines : []))
        .map((line) =>
            line.segments
                .filter(
                    (seg) => (seg.kind === 'text' || seg.kind === 'italic') && seg.verse === verse,
                )
                .map((seg) => ('text' in seg ? seg.text : ''))
                .join(''),
        )
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 140 ? `${text.slice(0, 140).replace(/\s+\S*$/, '')} …` : text;
}

async function toggleLesezeichen(verse: number) {
    const { slug, chapter } = here.value;
    const label = verseRefLabel({ slug, chapter }, verse);
    try {
        const set = await lesezeichenStore.toggle(slug, chapter, verse, snippetOf(verse));
        toast.success(set ? `Lesezeichen gesetzt: ${label}` : `Lesezeichen entfernt: ${label}`, {
            duration: 2000,
        });
    } catch (err) {
        console.error('Error saving the Lesezeichen:', err);
        toast.error('Das Lesezeichen konnte nicht gespeichert werden.');
    }
}

// --- Loading ----------------------------------------------------------------

async function load() {
    const { slug, chapter } = here.value;
    openNotes.value = new Set();
    if (!book.value || chapter < 1 || chapter > book.value.chapters) {
        state.value = 'missing';
        return;
    }

    state.value = 'loading';
    try {
        const chapters = await loadBook(slug);
        // The reader may have turned on while the book was loading.
        if (slug !== here.value.slug || chapter !== here.value.chapter) return;
        blocks.value = chapters[chapter - 1] ?? [];
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
    const target = markedVerse.value && document.getElementById(`vers-${markedVerse.value}`);
    if (target) target.scrollIntoView({ block: 'center' });
    else scrollRef.value?.scrollTo({ top: 0 });
}

watch(() => [here.value.slug, here.value.chapter], load, { immediate: true });
</script>

<style scoped>
/* The reading size follows the song page's Größe setting, so whoever enlarged
   the hymns does not have to enlarge the Bible again. */
.bibel-text {
    font-size: calc(1.0625rem * var(--bibel-scale, 1));
    line-height: 1.6;
}

.bibel-heading {
    text-wrap: balance;
}
.bibel-h2 {
    margin: 2rem 0 0.75rem;
    font-size: 1.45em;
}
.bibel-h3 {
    margin: 1.75rem 0 0.5rem;
    font-size: 1.2em;
}
.bibel-h4 {
    margin: 1.25rem 0 0.375rem;
    font-size: 1.05em;
    font-style: italic;
}
.bibel-heading:first-child,
.label-micro + .bibel-heading {
    margin-top: 0.5rem;
}

.bibel-para {
    margin-bottom: 0.9em;
}

/* Prose: the lines are verses, run together into one paragraph. */
.bibel-para:not(.bibel-poetry) .bibel-line::after {
    content: ' ';
}

/* Poetry: one line per line, as Menge sets it. The verse numbers stand in a
   margin column of their own, so every line's words start on the same edge
   whether or not a verse begins there; Menge's indents step in from that edge,
   and a line too long for the column wraps a little further in still. */
.bibel-poetry .bibel-line {
    position: relative;
    display: block;
    padding-left: calc(1.75em + 0.875em * var(--indent, 0) + 0.875em);
    text-indent: -0.875em;
}

.bibel-verse {
    padding: 0 0.2em;
    margin-right: 0.15em;
    font-size: 0.7em;
    font-style: normal;
    line-height: 1;
    vertical-align: super;
    border-radius: 0.3em;
}
.bibel-verse:hover {
    background: var(--muted);
}

/* In the poetry's margin column, its right edge just short of the words.
   2.5em of the number's own size is the column's 1.75em of the text's; the
   translate puts the number's end there, however many digits it has. */
.bibel-poetry .bibel-verse {
    position: absolute;
    top: 0.55em;
    left: 2.5em;
    margin: 0;
    padding: 0.1em 0.2em;
    text-indent: 0;
    vertical-align: baseline;
    transform: translateX(calc(-100% - 0.35em));
}

/* A marked verse: its number on a gold tab, the way a ribbon marks a page.
   Colour only — the mark must not move a word. */
.bibel-verse-set,
.bibel-verse-set:hover {
    background: var(--gold);
    color: var(--background);
    font-weight: 700;
}

.bibel-note-mark {
    padding: 0 0.1em 0 0.05em;
    color: var(--gold);
    font-size: 0.85em;
    vertical-align: super;
    line-height: 0;
}

.bibel-note {
    color: var(--muted-foreground);
    font-size: 0.85em;
    font-style: italic;
}

.bibel-marked {
    background: color-mix(in srgb, var(--gold) 18%, transparent);
    border-radius: 0.15em;
    box-decoration-break: clone;
}
</style>
