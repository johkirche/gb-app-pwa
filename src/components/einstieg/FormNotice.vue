<template>
    <div
        v-if="message"
        :role="tone === 'error' ? 'alert' : 'status'"
        class="flex items-start gap-3 rounded-lg border-l-4 px-4 py-3"
        :class="
            tone === 'error'
                ? 'border-destructive bg-destructive/10'
                : 'border-flourish bg-flourish/10'
        "
    >
        <CircleAlert
            v-if="tone === 'error'"
            class="mt-0.5 size-5 shrink-0 text-destructive"
            aria-hidden="true"
        />
        <Info v-else class="mt-0.5 size-5 shrink-0 text-flourish" aria-hidden="true" />
        <p
            class="min-w-0 text-sm font-medium leading-relaxed"
            :class="tone === 'error' && 'text-destructive'"
        >
            {{ message }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { CircleAlert, Info } from 'lucide-vue-next';

withDefaults(defineProps<{ message: string | null; tone?: 'error' | 'info' }>(), {
    tone: 'error',
});
</script>
