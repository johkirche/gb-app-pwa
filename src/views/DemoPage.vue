<template>
    <!-- Where a QR code lands. Mostly seen for the second or two the songs take
         to arrive; the two states that stay are a demo that is over and one
         that could not be reached. -->
    <div class="flex h-full flex-col overflow-y-auto bg-background">
        <div
            class="page-col flex min-h-full flex-col items-center justify-center px-6 py-12 pt-[max(3rem,env(safe-area-inset-top))] text-center"
        >
            <template v-if="state === 'loading'">
                <Spinner class="size-10" />
                <h1 class="mt-4 font-display text-2xl font-semibold">Gesangbuch wird geladen</h1>
                <p class="mt-2 max-w-96 text-sm tabular-nums text-muted-foreground">
                    {{ progressLabel }}
                </p>
                <Progress
                    v-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                    :model-value="syncProgress.current / syncProgress.total"
                    class="mt-4 w-full max-w-64"
                />
            </template>

            <template v-else-if="state === 'closed'">
                <CalendarX
                    class="size-14 text-muted-foreground"
                    stroke-width="1.25"
                    aria-hidden="true"
                />
                <h1 class="mt-4 font-display text-2xl font-semibold">Die Vorschau ist beendet</h1>
                <p class="mt-2 max-w-96 text-sm text-muted-foreground">
                    Dieser Link ist nicht mehr gültig. Vielen Dank fürs Ausprobieren des neuen
                    Gesangbuchs.
                </p>
            </template>

            <template v-else>
                <WifiOff
                    class="size-14 text-muted-foreground"
                    stroke-width="1.25"
                    aria-hidden="true"
                />
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
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { CalendarX, RotateCw, WifiOff } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';
import { useUserStore } from '@/stores/user';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

import { DemoUnavailableError } from '@/api/demo.api';

const route = useRoute();
const router = useRouter();
const songsStore = useSongsStore();
const userStore = useUserStore();
const { syncProgress } = storeToRefs(songsStore);

const state = ref<'loading' | 'closed' | 'unreachable'>('loading');

const progressLabel = computed(() => {
    if (syncProgress.value.phase === 'files' && syncProgress.value.total > 0) {
        return `${syncProgress.value.current} von ${syncProgress.value.total} Notendateien`;
    }
    return 'Die Lieder werden geladen…';
});

async function load() {
    state.value = 'loading';
    try {
        await songsStore.loadDemo(String(route.params.key));
        // Replace, so Back from the song list does not land here and load it
        // all a second time.
        await router.replace('/tabs/lieder');
    } catch (err) {
        console.error('Demo could not be loaded:', err);
        state.value =
            err instanceof DemoUnavailableError && err.reason === 'closed'
                ? 'closed'
                : 'unreachable';
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
