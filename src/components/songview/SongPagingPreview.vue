<template>
    <!-- The foot of a song page at the chosen setting, and a true one: the bar
         is the page's own SongNavBar with sample songs in it, so what the
         setting promises here is what the page shows there. Inert, because
         these are real buttons and a preview must not turn any page. -->
    <div class="paging-preview" inert aria-hidden="true">
        <div class="paging-page">
            <p class="paging-credit">Text: Joachim Neander (1650–1680)</p>
            <SongNavBar
                v-if="sample"
                :label="sample.label"
                :position="sample.position"
                :total="sample.total"
                :prev="sample.prev"
                :next="sample.next"
            />
        </div>
        <p class="paging-caption">{{ caption }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import SongNavBar from '@/components/songview/SongNavBar.vue';

import type { SongPagingMode } from '@/db';

const props = defineProps<{ mode: SongPagingMode }>();

// Neighbours the way each setting would name them: a service's own order
// for the default, the list by number once paging is on everywhere.
const SAMPLES = {
    lists: {
        label: 'Gottesdienst',
        position: 2,
        total: 4,
        prev: { id: 'a', index: 118, titel: 'O Heiland, reiß die Himmel auf' },
        next: { id: 'b', index: 119, titel: 'Wie schön leuchtet der Morgenstern' },
    },
    always: {
        label: 'Liederliste',
        position: 122,
        total: 340,
        prev: { id: 'a', index: 121, titel: 'Nun danket alle Gott' },
        next: { id: 'b', index: 123, titel: 'Lobe den Herren' },
    },
} as const;

const sample = computed(() => (props.mode === 'never' ? null : SAMPLES[props.mode]));

const caption = computed(() => {
    switch (props.mode) {
        case 'lists':
            return 'So endet ein Lied, das aus einer Playlist oder dem Gottesdienst geöffnet wurde.';
        case 'always':
            return 'So endet jedes Lied, auch aus der Liederliste.';
        default:
            return 'Die Seite endet bei den Urhebern, wie bisher.';
    }
});
</script>

<style scoped>
.paging-page {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    background: var(--background);
}

.paging-credit {
    margin: 0;
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    color: var(--muted-foreground);
}

.paging-caption {
    margin: 0.5rem 0 0;
    font-size: 0.8125rem;
    line-height: 1.4;
    text-align: center;
    text-wrap: balance;
    color: var(--muted-foreground);
}
</style>
