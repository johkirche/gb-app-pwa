<!--
    The Bible's offline state, and the download that completes it. One row in
    the settings' style, used on the Bibel tab and under Einstellungen → Daten;
    both read the same state (useBibelOffline), so a download started in one
    place shows its progress in the other.

    Hidden where the browser has no Cache Storage: there is nothing to promise.
-->
<template>
    <div v-if="supported && available !== null">
        <div v-if="downloading" class="flex items-center gap-4 px-2 py-3" aria-live="polite">
            <CloudDownload class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0 flex-1">
                <p class="text-[15px]">Bibel wird geladen …</p>
                <Progress
                    :model-value="available"
                    :max="total"
                    class="mt-2"
                    aria-label="Fortschritt"
                />
                <p class="mt-1.5 text-sm text-muted-foreground">
                    {{ available }} von {{ total }} Büchern
                </p>
            </div>
        </div>

        <div v-else-if="complete" class="flex items-center gap-4 px-2 py-3">
            <CircleCheck class="size-5 shrink-0 text-gold" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[15px]">Bibel offline verfügbar</p>
                <p class="text-sm text-muted-foreground">
                    Alle {{ total }} Bücher sind auf dem Gerät.
                </p>
            </div>
        </div>

        <button
            v-else
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="download"
        >
            <component
                :is="failed ? WifiOff : CloudDownload"
                class="size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
                <p class="text-[15px]">
                    {{ failed ? 'Bibel weiter laden' : 'Bibel für offline laden' }}
                    <span class="text-muted-foreground">· {{ BIBEL_DOWNLOAD_SIZE }}</span>
                </p>
                <p class="text-sm text-muted-foreground" aria-live="polite">
                    {{ detail }}
                </p>
            </div>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted } from 'vue';

import { CircleCheck, CloudDownload, WifiOff } from 'lucide-vue-next';

import { useBibelOffline } from '@/composables/useBibelOffline';

import { Progress } from '@/components/ui/progress';

import { BIBEL_DOWNLOAD_SIZE } from '@/utils/bibelOffline';

const { total, available, supported, downloading, failed, complete, refresh, download } =
    useBibelOffline();

// Said plainly when the connection dropped: what did arrive is kept, and the
// next tap fetches only the rest.
const detail = computed(() => {
    const have = available.value ?? 0;
    if (failed.value) {
        return `Verbindung unterbrochen. ${have} von ${total} Büchern sind offline verfügbar.`;
    }
    if (have > 0) return `${have} von ${total} Büchern sind schon auf dem Gerät.`;
    return 'Danach ist jedes Buch auch ohne Internet lesbar.';
});

// Books also arrive by reading them, so the count is asked again on every visit.
onMounted(refresh);
onActivated(refresh);
</script>
