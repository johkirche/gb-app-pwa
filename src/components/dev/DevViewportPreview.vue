<template>
    <!-- Preview the current route in a phone-sized viewport without resizing
         the browser. Rendered via an iframe so media queries (lg: sidebar vs.
         tab bar) respond to the PHONE width, not the browser's. Shown on
         desktop widths only — on a phone the real layout is already on screen.
         Never rendered inside the iframe itself (no recursion). -->
    <template v-if="!isInsideIframe">
        <button
            type="button"
            class="fixed bottom-4 right-4 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:text-foreground lg:flex"
            aria-label="Mobile Vorschau umschalten"
            title="Mobile Vorschau"
            @click="open = true"
        >
            <Smartphone class="h-5 w-5" aria-hidden="true" />
        </button>

        <!-- Opaque stage: the surrounding desktop app must not shine through,
             otherwise the phone layout is impossible to judge. -->
        <div
            v-if="open"
            class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-neutral-900 p-6"
            @click.self="open = false"
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
                    class="overflow-hidden rounded-[2rem] border-[6px] border-neutral-700 bg-background shadow-2xl"
                >
                    <iframe
                        :src="frameSrc"
                        title="Mobile Vorschau"
                        class="block h-[min(844px,80vh)] w-[390px] border-0"
                    />
                </div>
            </div>
            <p class="text-center text-xs text-white/60">
                390 × 844 · eigene App-Instanz (Anmeldung/Dev-Skip ggf. erneut nötig) · Esc zum
                Schließen
            </p>
        </div>
    </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Smartphone, X } from 'lucide-vue-next';
import { useRoute } from 'vue-router';

const route = useRoute();
const open = ref(false);

const isInsideIframe = window.self !== window.top;

// This component also mounts INSIDE the preview iframe (it just renders
// nothing there). Use that to make the framed app behave like a phone:
// no desktop scrollbar chrome.
if (isInsideIframe) {
    document.documentElement.classList.add('viewport-preview');
}

// Snapshot the route when opening so the frame starts where the user is
const frameSrc = computed(() => (open.value ? route.fullPath : 'about:blank'));

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') open.value = false;
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style>
/* Applied to <html> of the framed app instance only (see above). */
html.viewport-preview * {
    scrollbar-width: none;
}

html.viewport-preview ::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}
</style>
