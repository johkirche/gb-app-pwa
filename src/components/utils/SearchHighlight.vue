<!--
    Ein Text, in dem die Suchwörter markiert stehen.

    Markiert wird allein über den Hintergrund: die <mark> des Browsers brächte
    ihr Standardgelb samt schwarzer Schrift mit und würde damit die goldene
    Liednummer wie den dunklen Titel überschreiben — text-inherit lässt beiden
    ihre Farbe. Zerlegt wird in `highlightParts` (src/utils/search.ts), das die
    Treffer auf der gefalteten Fassung sucht und in den Originaltext zurückrechnet.
-->
<template>
    <span>
        <template v-for="(part, index) in parts" :key="index">
            <mark v-if="part.match" class="rounded-[2px] bg-gold/20 text-inherit">
                {{ part.text }}
            </mark>
            <span v-else>{{ part.text }}</span>
        </template>
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { highlightParts } from '@/utils/search';

const props = defineProps<{
    /** Der Text, wie er dasteht — ungefaltet, so wie er gelesen wird. */
    text: string;
    /** Die Suchwörter aus `searchTerms`. Ohne sie bleibt der Text unberührt. */
    terms: string[];
}>();

const parts = computed(() => highlightParts(props.text, props.terms));
</script>
