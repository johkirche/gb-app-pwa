<template>
    <!-- Highlights and notes, the newest few: a verse with both is one row, a
         passage marked at once is one row. Made and changed in the text; all
         of them are found again on Meine Stellen. -->
    <section class="mt-6" aria-labelledby="notizen-markierungen-heading">
        <h2 id="notizen-markierungen-heading" class="font-display text-xl font-semibold">
            Notizen &amp; Markierungen
        </h2>
        <p v-if="entries.length === 0" class="mt-1 px-2 text-sm text-muted-foreground">
            Noch keine. Im Text auf einen Vers tippen, um ihn zu markieren oder eine Notiz zu
            schreiben.
        </p>
        <template v-else>
            <ul class="mt-1 divide-y divide-border">
                <li v-for="entry in preview" :key="entry.id">
                    <BibelStellenRow :stelle="entry" />
                </li>
            </ul>
            <BibelStellenMore
                :count="entries.length"
                :shown="preview.length"
                to="/tabs/bibel/stellen"
            />
        </template>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useMarkierungenStore } from '@/stores/markierungen';
import { useNotizenStore } from '@/stores/notizen';

import BibelStellenMore from '@/components/bibel/BibelStellenMore.vue';
import BibelStellenRow from '@/components/bibel/BibelStellenRow.vue';

import { STELLEN_PREVIEW, filterStellen, stellen } from '@/utils/meineStellen';

const markierungen = useMarkierungenStore();
const notizen = useNotizenStore();

const entries = computed(() =>
    filterStellen(stellen([], markierungen.markierungen, notizen.notizen), {
        art: 'alle',
        ordnung: 'neueste',
    }),
);
const preview = computed(() => entries.value.slice(0, STELLEN_PREVIEW));
</script>
