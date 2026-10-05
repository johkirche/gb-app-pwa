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

                    <BibelChapterText
                        v-else
                        :slug="here.slug"
                        :chapter="here.chapter"
                        :blocks="blocks"
                        :marked-verse="markedVerse"
                    />
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

        <BibelVerseActions />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { ChevronLeft, ChevronRight, WifiOff } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { RouterLink, useRoute } from 'vue-router';

import { usePreferencesStore } from '@/stores/preferences';

import BibelChapterText from '@/components/bibel/BibelChapterText.vue';
import BibelVerseActions from '@/components/bibel/BibelVerseActions.vue';
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

async function load() {
    const { slug, chapter } = here.value;
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
</style>
