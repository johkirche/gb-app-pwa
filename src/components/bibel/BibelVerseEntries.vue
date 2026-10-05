<template>
    <!-- Highlights and notes, newest first, a verse with both as one row.
         Made and changed in the text; here they are found again. -->
    <section class="mt-6" aria-labelledby="notizen-markierungen-heading">
        <h2 id="notizen-markierungen-heading" class="font-display text-xl font-semibold">
            Notizen &amp; Markierungen
        </h2>
        <p v-if="entries.length === 0" class="mt-1 px-2 text-sm text-muted-foreground">
            Noch keine. Im Text auf einen Vers tippen, um ihn zu markieren oder eine Notiz zu
            schreiben.
        </p>
        <ul v-else class="mt-1 divide-y divide-border">
            <li v-for="entry in entries" :key="entry.id">
                <RouterLink
                    :to="chapterPath(entry, entry.verse)"
                    class="flex items-start gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-muted"
                >
                    <span
                        v-if="entry.color"
                        class="mt-1 size-3.5 shrink-0 rounded-full border border-border"
                        :style="{ background: `var(--bibel-mark-${entry.color})` }"
                        aria-hidden="true"
                    />
                    <NotebookPen
                        v-else
                        class="mt-0.5 size-[18px] shrink-0 text-gold"
                        aria-hidden="true"
                    />
                    <span class="min-w-0">
                        <span class="block text-[15px] font-medium leading-tight">
                            {{ verseRefLabel(entry, entry.verse) }}
                        </span>
                        <span
                            v-if="entry.note"
                            class="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground"
                            v-text="entry.note"
                        />
                    </span>
                </RouterLink>
            </li>
        </ul>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { NotebookPen } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import { useMarkierungenStore } from '@/stores/markierungen';
import { useNotizenStore } from '@/stores/notizen';

import { chapterPath, verseRefLabel } from '@/utils/bibel';
import { verseEntries } from '@/utils/bibelVerses';

import './bibel-marks.css';

const markierungen = useMarkierungenStore();
const notizen = useNotizenStore();

const entries = computed(() => verseEntries(markierungen.markierungen, notizen.notizen));
</script>
