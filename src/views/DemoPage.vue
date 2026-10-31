<template>
    <!-- Where a QR code lands: a welcome, read while the songs arrive. It
         waits for the visitor rather than moving on by itself, so nobody is
         whisked off the page halfway through it. A link that has closed goes on
         to the end of the demo (DemoEndPage); one that could not be reached
         stays here, with the way to try again. -->
    <div class="flex h-full flex-col overflow-y-auto bg-background">
        <!-- Read top to bottom like a page of the book, with what to do next
             at the foot, where the thumb is. -->
        <div
            v-if="state !== 'unreachable'"
            class="page-col flex min-h-full max-w-md flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]"
        >
            <img src="/logo.svg" alt="" class="h-20 w-auto self-start" />
            <p class="label-micro mt-8 text-flourish">Vorschau · Johannische Kirche</p>
            <h1 class="mt-2 text-balance font-display text-4xl font-semibold leading-tight">
                Willkommen beim neuen Gesangbuch
            </h1>
            <figure class="mt-6 border-l-2 border-flourish pl-4">
                <blockquote class="font-display text-xl leading-snug">
                    Jauchzet dem Herrn,
                    <br />
                    alle Welt;
                    <br />
                    singet,
                    <br />
                    rühmet und lobet!
                </blockquote>
                <figcaption class="label-micro mt-2 text-flourish">Psalm 98</figcaption>
            </figure>
            <!-- Listening comes in once the event is over (DEMO_PLAYBACK_FROM
                 in worker/demo.ts); until then a phone in the hall reads. -->
            <p class="mt-6 text-sm leading-relaxed text-muted-foreground">
                {{
                    demoPlayback
                        ? 'Probieren Sie es aus: Lied öffnen, mitlesen und anhören.'
                        : 'Probieren Sie es aus: Lied öffnen und mitlesen.'
                }}
            </p>

            <div class="mt-auto pt-10">
                <p
                    v-if="offlineReady"
                    class="flex items-start gap-2 text-sm leading-snug"
                    aria-live="polite"
                >
                    <Plane class="mt-0.5 size-4 shrink-0 text-flourish" aria-hidden="true" />
                    Alles ist auf dem Gerät. Sie können jetzt den Flugmodus einschalten.
                </p>
                <p v-else class="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                    {{ progressLabel }}
                </p>
                <!-- Only once there is something to count; the space stays,
                     so the button does not move when it appears. -->
                <div class="mt-2 h-1">
                    <Progress v-if="progress > 0" :model-value="progress" class="h-1" />
                </div>
                <Button
                    size="lg"
                    class="mt-4 w-full"
                    :disabled="state !== 'ready'"
                    @click="router.replace('/tabs/lieder')"
                >
                    Lieder ansehen
                </Button>
            </div>
        </div>

        <div
            v-else
            class="page-col flex min-h-full flex-col items-center justify-center px-6 py-12 pt-[max(3rem,env(safe-area-inset-top))] text-center"
        >
            <WifiOff class="size-14 text-muted-foreground" stroke-width="1.25" aria-hidden="true" />
            <h1 class="mt-4 font-display text-2xl font-semibold">
                Lieder konnten nicht geladen werden
            </h1>
            <p class="mt-2 max-w-96 text-sm text-muted-foreground">
                Bitte prüfen Sie die Internetverbindung und versuchen Sie es erneut.
            </p>
            <Button class="mt-6" @click="load">
                <RotateCw aria-hidden="true" />
                Erneut versuchen
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Plane, RotateCw, WifiOff } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';
import { useUserStore } from '@/stores/user';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { DemoUnavailableError } from '@/api/demo.api';

const route = useRoute();
const router = useRouter();
const songsStore = useSongsStore();
const userStore = useUserStore();
const { syncProgress, demoPlayback } = storeToRefs(songsStore);

const state = ref<'loading' | 'ready' | 'unreachable'>('loading');

// The app itself is stored once a service worker is active: it only gets
// there after it has precached every file of the build. Never in a browser
// without one, and then the flight-mode line is never shown either.
const shellStored = ref(false);
if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.ready.then(() => (shellStored.value = true));
}

// Both halves of reading offline: the songs and the app to read them in.
const offlineReady = computed(() => state.value === 'ready' && shellStored.value);

const progressLabel = computed(() => {
    if (state.value === 'ready') return 'Die Lieder sind auf dem Gerät';
    if (syncProgress.value.phase === 'files' && syncProgress.value.total > 0) {
        return `${syncProgress.value.current} von ${syncProgress.value.total} Notendateien`;
    }
    return 'Die Lieder werden geladen …';
});

const progress = computed(() => {
    if (state.value === 'ready') return 1;
    const { phase, current, total } = syncProgress.value;
    return phase === 'files' && total > 0 ? current / total : 0;
});

async function load() {
    state.value = 'loading';
    try {
        await songsStore.loadDemo(String(route.params.key));
        // The button replaces, so Back from the song list does not land here
        // and load it all a second time.
        state.value = 'ready';
    } catch (err) {
        console.error('Demo could not be loaded:', err);
        if (err instanceof DemoUnavailableError && err.reason === 'closed') {
            await router.replace({ name: 'DemoEnd' });
            return;
        }
        // The link opened again in flight mode, or in a hall with no signal:
        // the songs from last time are still here, and are enough to read.
        const stored = songsStore.demoKey === String(route.params.key) && songsStore.hasSongs;
        state.value = stored ? 'ready' : 'unreachable';
    }
}

onMounted(async () => {
    await Promise.all([userStore.initPromise, songsStore.initPromise]);

    // Someone who already has the whole book has these songs too. A demo must
    // never replace it — with an account it is a sync away, but without one
    // (a session that lapsed) it could not be brought back at all.
    if (userStore.isLoggedIn || (songsStore.hasSongs && !songsStore.demoKey)) {
        await router.replace('/tabs/lieder');
        return;
    }

    await load();
});
</script>
