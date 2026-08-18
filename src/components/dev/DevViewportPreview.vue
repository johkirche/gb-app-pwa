<template>
    <!-- Dev-only helper: preview the current route in a phone-sized viewport
         without resizing the browser. Rendered via an iframe so media queries
         (lg: sidebar vs. tab bar) respond to the PHONE width, not the browser's.
         Never rendered inside the iframe itself (no recursion). -->
    <template v-if="!isInsideIframe">
        <button
            type="button"
            class="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:text-foreground"
            aria-label="Mobile Vorschau umschalten"
            title="Mobile Vorschau (nur Entwicklung)"
            @click="open = !open"
        >
            <Smartphone class="h-5 w-5" aria-hidden="true" />
        </button>

        <div
            v-if="open"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
            @click.self="open = false"
            @keydown.esc="open = false"
        >
            <div class="relative">
                <button
                    type="button"
                    class="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:text-foreground"
                    aria-label="Vorschau schließen"
                    @click="open = false"
                >
                    <X class="h-4 w-4" aria-hidden="true" />
                </button>
                <div
                    class="overflow-hidden rounded-[2rem] border-[6px] border-border bg-background shadow-2xl"
                >
                    <iframe
                        :src="frameSrc"
                        title="Mobile Vorschau"
                        class="block h-[min(844px,85vh)] w-[390px] border-0"
                    />
                </div>
                <p class="mt-3 text-center text-xs text-white/70">
                    390 × 844 · eigene App-Instanz (Anmeldung/Dev-Skip ggf. erneut nötig)
                </p>
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Smartphone, X } from 'lucide-vue-next';
import { useRoute } from 'vue-router';

const route = useRoute();
const open = ref(false);

const isInsideIframe = window.self !== window.top;

// Snapshot the route when opening so the frame starts where the user is
const frameSrc = computed(() => (open.value ? route.fullPath : 'about:blank'));
</script>
