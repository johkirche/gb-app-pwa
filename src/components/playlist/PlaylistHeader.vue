<template>
    <div class="flex flex-col items-center px-4 pb-2 pt-8 text-center">
        <div class="text-6xl leading-none">{{ emoji }}</div>
        <h1 class="mt-4 break-words font-display text-3xl font-semibold leading-tight">
            {{ name }}
        </h1>
        <p class="mt-1.5 text-sm text-muted-foreground">
            {{ songCount }} {{ songCount === 1 ? 'Lied' : 'Lieder' }} · Erstellt am
            {{ formattedDate }}
        </p>
        <div class="rule-flourish mt-6 w-full max-w-[12rem] text-[9px]" aria-hidden="true">✦</div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    emoji: string;
    name: string;
    songCount: number;
    createdAt: Date;
}>();

const formattedDate = computed(() => {
    return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(props.createdAt));
});
</script>
