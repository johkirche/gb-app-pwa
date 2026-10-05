<template>
    <!-- Below the page turn, on the reading measure: the chapter comes first,
         the songs that sing it are a way onward from there. Nothing at all
         when no song on this device cites the chapter. -->
    <section
        v-if="entries.length > 0"
        class="mx-auto mt-8 max-w-[36rem]"
        aria-labelledby="kapitel-lieder-heading"
    >
        <h2 id="kapitel-lieder-heading" class="label-micro mb-1 text-muted-foreground">
            Lieder zu diesem Kapitel
        </h2>
        <ul class="divide-y divide-border">
            <li v-for="{ song, stellen } in entries" :key="song.id">
                <RouterLink
                    :to="`/songs/${song.id}`"
                    class="flex items-start gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-muted active:bg-muted"
                >
                    <Music class="mt-0.5 size-[18px] shrink-0 text-gold" aria-hidden="true" />
                    <span class="min-w-0">
                        <span class="block text-[15px] font-medium leading-tight">
                            <span v-if="song.index" class="number-display mr-0.5">
                                {{ song.index }}.
                            </span>
                            {{ song.titel }}
                        </span>
                        <span
                            v-for="stelle in stellen"
                            :key="stelle.ref"
                            class="mt-0.5 block text-sm text-muted-foreground"
                        >
                            {{ stelle.ref }}
                            <template v-if="stelle.note">· {{ stelle.note }}</template>
                        </span>
                    </span>
                </RouterLink>
            </li>
        </ul>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Music } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import { useChapterSongIndex } from '@/composables/useChapterSongIndex';

import { songsForChapter } from '@/utils/bibelLieder';

const props = defineProps<{
    slug: string;
    chapter: number;
}>();

const index = useChapterSongIndex();

const entries = computed(() => songsForChapter(index.value, props.slug, props.chapter));
</script>
