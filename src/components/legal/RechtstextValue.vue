<template>
    <!-- One of the organisation's entries, as written in Directus: paragraphs
         on blank lines, line breaks kept (an address is written in lines). -->
    <div v-if="value" class="space-y-3">
        <p v-for="(paragraph, i) in paragraphs" :key="i" class="whitespace-pre-line">
            {{ paragraph }}
        </p>
    </div>
    <p v-else-if="state === 'loading'" class="text-muted-foreground">…</p>
    <p v-else-if="state === 'missing'" class="italic text-muted-foreground">
        Wird geladen, sobald das Gerät mit dem Internet verbunden ist.
    </p>
    <p v-else class="italic text-muted-foreground">Wird von der Organisation ergänzt.</p>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    value: string | null | undefined;
    state: 'loading' | 'ready' | 'missing';
}>();

const paragraphs = computed(() => (props.value ?? '').split(/\n\s*\n/).map((p) => p.trim()));
</script>
