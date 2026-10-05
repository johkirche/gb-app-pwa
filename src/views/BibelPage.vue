<template>
    <div class="relative flex h-full flex-col bg-background">
        <AppPageHeader title="Bibel" />

        <main ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col pb-24">
                <!-- Where the reader left off, in the place the Lied der Woche
                     holds on the song list. -->
                <RouterLink
                    v-if="lastRead"
                    :to="chapterPath(lastRead)"
                    class="mb-2 mt-4 block w-full rounded-lg border bg-card text-left text-card-foreground shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
                >
                    <span class="flex items-center gap-5 p-5">
                        <BookOpen class="size-9 shrink-0 text-gold" aria-hidden="true" />
                        <span class="block min-w-0">
                            <span class="label-micro block text-gold">Weiterlesen</span>
                            <span
                                class="mt-1 block font-display text-2xl font-semibold leading-tight"
                            >
                                {{ chapterLabel(lastRead) }}
                            </span>
                        </span>
                    </span>
                </RouterLink>

                <BibelVerseOfTheWeek />

                <!-- Lesezeichen, newest first. Set and taken off by tapping a
                     verse number in the text; here they can also be removed. -->
                <section class="mt-6" aria-labelledby="lesezeichen-heading">
                    <h2 id="lesezeichen-heading" class="font-display text-xl font-semibold">
                        Lesezeichen
                    </h2>
                    <p
                        v-if="lesezeichenStore.sorted.length === 0"
                        class="mt-1 px-2 text-sm text-muted-foreground"
                    >
                        Noch keine. Im Text auf eine Versnummer tippen, um eine Stelle zu markieren.
                    </p>
                    <ul v-else class="mt-1 divide-y divide-border">
                        <li
                            v-for="mark in lesezeichenStore.sorted"
                            :key="mark.id"
                            class="flex items-center rounded-sm transition-colors hover:bg-muted"
                        >
                            <RouterLink
                                :to="
                                    chapterPath(
                                        { slug: mark.slug, chapter: mark.chapter },
                                        mark.verse,
                                    )
                                "
                                class="flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-2"
                            >
                                <Bookmark
                                    class="mt-0.5 size-[18px] shrink-0 fill-current text-gold"
                                    aria-hidden="true"
                                />
                                <span class="min-w-0">
                                    <span class="block text-[15px] font-medium leading-tight">
                                        {{
                                            verseRefLabel(
                                                { slug: mark.slug, chapter: mark.chapter },
                                                mark.verse,
                                            )
                                        }}
                                    </span>
                                    <span class="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                                        {{ mark.snippet }}
                                    </span>
                                </span>
                            </RouterLink>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="shrink-0"
                                :aria-label="`Lesezeichen ${verseRefLabel({ slug: mark.slug, chapter: mark.chapter }, mark.verse)} entfernen`"
                                @click="lesezeichenStore.remove(mark.id)"
                            >
                                <X class="!size-[18px] text-muted-foreground" aria-hidden="true" />
                            </Button>
                        </li>
                    </ul>
                </section>

                <!-- The canon as the book orders it: two Testaments, each in
                     its traditional groups. A book opens to its chapters in
                     place; a one-chapter book is opened straight away. -->
                <section v-for="testament in testaments" :key="testament.key" class="mt-6">
                    <h2 class="font-display text-xl font-semibold">{{ testament.label }}</h2>

                    <template v-for="group in testament.groups" :key="group.label">
                        <h3 class="label-micro mb-1 mt-4 px-2 text-muted-foreground">
                            {{ group.label }}
                        </h3>
                        <ul class="divide-y divide-border">
                            <li v-for="book in group.books" :key="book.slug">
                                <button
                                    type="button"
                                    class="flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                                    :aria-expanded="
                                        book.chapters > 1 ? openBook === book.slug : undefined
                                    "
                                    @click="onBook(book)"
                                >
                                    <span class="min-w-0 flex-1">
                                        <span class="block text-[15px] font-medium leading-tight">
                                            {{ book.name }}
                                        </span>
                                        <span class="mt-0.5 block text-sm text-muted-foreground">
                                            {{ book.title }}
                                        </span>
                                    </span>
                                    <span class="shrink-0 text-sm text-muted-foreground">
                                        {{ book.chapters }} Kap.
                                    </span>
                                    <ChevronRight
                                        class="size-[18px] shrink-0 text-muted-foreground transition-transform"
                                        :class="{ 'rotate-90': openBook === book.slug }"
                                        aria-hidden="true"
                                    />
                                </button>

                                <nav
                                    v-if="openBook === book.slug"
                                    class="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 px-2 pb-3 pt-1"
                                    :aria-label="`Kapitel von ${book.name}`"
                                >
                                    <RouterLink
                                        v-for="n in book.chapters"
                                        :key="n"
                                        :to="chapterPath({ slug: book.slug, chapter: n })"
                                        class="flex h-11 items-center justify-center rounded-md border border-border text-[15px] transition-colors hover:border-primary/40 hover:bg-muted active:bg-muted"
                                    >
                                        {{ n }}
                                    </RouterLink>
                                </nav>
                            </li>
                        </ul>
                    </template>
                </section>

                <p class="mt-8 px-2 text-xs text-muted-foreground">
                    {{ BIBEL_TRANSLATION }}, gemeinfrei. Einmal gelesene Bücher bleiben auch offline
                    verfügbar.
                </p>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onActivated, ref } from 'vue';

import { BookOpen, Bookmark, ChevronRight, X } from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';

import { useLesezeichenStore } from '@/stores/lesezeichen';

import { useKeepAliveScroll } from '@/composables/useKeepAliveScroll';

import BibelVerseOfTheWeek from '@/components/bibel/BibelVerseOfTheWeek.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import { Button } from '@/components/ui/button';

import {
    BIBEL_BOOKS,
    BIBEL_TRANSLATION,
    type BibelBook,
    type ChapterRef,
    chapterLabel,
    chapterPath,
    getLastRead,
    verseRefLabel,
} from '@/utils/bibel';

const router = useRouter();
const lesezeichenStore = useLesezeichenStore();

const scrollRef = ref<HTMLElement | null>(null);
useKeepAliveScroll(scrollRef);

const testaments = (['AT', 'NT'] as const).map((key) => {
    const books = BIBEL_BOOKS.filter((book) => book.testament === key);
    const labels = [...new Set(books.map((book) => book.group))];
    return {
        key,
        label: key === 'AT' ? 'Altes Testament' : 'Neues Testament',
        groups: labels.map((label) => ({
            label,
            books: books.filter((book) => book.group === label),
        })),
    };
});

const openBook = ref<string | null>(null);

function onBook(book: BibelBook) {
    if (book.chapters === 1) {
        router.push(chapterPath({ slug: book.slug, chapter: 1 }));
        return;
    }
    openBook.value = openBook.value === book.slug ? null : book.slug;
}

// Re-read on every visit: the tab is kept alive, and the reader has usually
// just come back from a chapter.
const lastRead = ref<ChapterRef | null>(null);

async function refreshLastRead() {
    try {
        lastRead.value = await getLastRead();
    } catch (err) {
        console.error('Error reading the last Bible position:', err);
    }
}

refreshLastRead();
onActivated(refreshLastRead);
</script>
