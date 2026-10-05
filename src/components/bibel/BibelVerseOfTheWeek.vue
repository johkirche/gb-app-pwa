<template>
    <!-- The Bibel tab's counterpart to the Lied der Woche: the same card, a
         verse in place of a song. The verse opens its chapter; the song below
         it is a link of its own, so the two never nest. -->
    <section
        v-if="pick"
        class="mb-2 mt-4 rounded-lg border bg-card text-card-foreground shadow-sm"
        aria-labelledby="vers-der-woche-heading"
    >
        <RouterLink
            :to="chapterPath(pick.ref, pick.ref.verse)"
            class="block rounded-lg p-5 transition hover:bg-muted/50 active:bg-muted/50"
        >
            <span id="vers-der-woche-heading" class="label-micro block text-gold">
                Vers der Woche
            </span>
            <!-- Until the book is on the device the reference stands alone,
                 set large in its place. -->
            <blockquote
                v-if="text"
                class="mt-2 font-hymnal text-[1.0625rem] leading-relaxed text-foreground"
            >
                {{ text }}
            </blockquote>
            <span
                class="block font-display font-semibold"
                :class="text ? 'mt-2 text-base' : 'mt-1 text-2xl'"
            >
                {{ pick.label }}
            </span>
        </RouterLink>

        <RouterLink
            v-if="song"
            :to="`/songs/${song.id}`"
            class="flex items-center gap-2 rounded-b-lg border-t border-border px-5 py-3 text-sm transition-colors hover:bg-muted active:bg-muted"
        >
            <Music class="size-4 shrink-0 text-gold" aria-hidden="true" />
            <span class="min-w-0 truncate">
                <span class="text-muted-foreground">Dazu im Gesangbuch:</span>
                <span v-if="song.index" class="number-display ml-1">{{ song.index }}</span>
                {{ song.titel }}
            </span>
        </RouterLink>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Music } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import { useChapterSongIndex } from '@/composables/useChapterSongIndex';
import { useCurrentDate } from '@/composables/useCurrentDate';

import { chapterPath, loadBook } from '@/utils/bibel';
import { layoutChapter, verseText } from '@/utils/bibelLayout';
import { songForVerse } from '@/utils/bibelLieder';
import { pickVerseOfTheWeek, versesOf } from '@/utils/verseOfTheWeek';

// A live date, as for the Lied der Woche: the tab is kept alive, and a phone
// can sit on the lectern from one week into the next.
const today = useCurrentDate();
const pick = computed(() => pickVerseOfTheWeek(today.value));

const index = useChapterSongIndex();
const song = computed(() => {
    if (!pick.value) return null;
    const { slug, chapter, verse } = pick.value.ref;
    return songForVerse(index.value, slug, chapter, verse)?.song ?? null;
});

const text = ref('');

watch(
    () => pick.value?.label,
    async () => {
        text.value = '';
        const current = pick.value;
        if (!current) return;
        try {
            const chapters = await loadBook(current.ref.slug);
            if (current !== pick.value) return;
            const laid = layoutChapter(chapters[current.ref.chapter - 1] ?? []);
            text.value = versesOf(current.ref)
                .map((verse) => verseText(laid, verse))
                .filter(Boolean)
                .join(' ');
        } catch (err) {
            // Offline with the book never opened: the reference alone is shown,
            // and tapping it says the rest.
            console.warn('Vers der Woche: book not available', err);
        }
    },
    { immediate: true },
);
</script>
