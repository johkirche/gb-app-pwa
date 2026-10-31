<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <div
            class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10"
        >
            <CloudDownload class="size-10 text-primary" aria-hidden="true" />
        </div>

        <h1 class="text-center font-display text-3xl font-semibold">Inhalte herunterladen</h1>
        <p class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
            Das Gesangbuch wird einmalig auf dieses Gerät geladen, damit alle Lieder und Noten auch
            ohne Internetverbindung verfügbar sind.
        </p>

        <ul class="mt-8 divide-y divide-border rounded-lg border border-border px-4">
            <li class="flex items-center gap-4 py-3">
                <Music class="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="text-[0.9375rem]">Alle Lieder und Texte</span>
            </li>
            <li class="flex items-center gap-4 py-3">
                <Image class="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="text-[0.9375rem]">Notendateien zum Offline-Lesen</span>
            </li>
            <li class="flex items-center gap-4 py-3">
                <Server class="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="min-w-0 text-[0.9375rem]">
                    Belegt ca. {{ formatBytes(ESTIMATED_SYNC_BYTES) }} auf dem Gerät
                    <template v-if="storageEstimate">
                        &ndash;
                        <span class="whitespace-nowrap">
                            frei:
                            {{ formatBytes(storageEstimate.quota - storageEstimate.usage) }}
                        </span>
                    </template>
                </span>
            </li>
        </ul>

        <!-- Before the download: the reader may be on mobile data, so it is
             their call when the book comes down, not the step's. The quote is
             the transfer, not the stored size — that is what a data plan pays. -->
        <div v-if="awaitingChoice" class="mt-6 flex items-start gap-4 rounded-lg bg-muted p-4">
            <Wifi class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p class="min-w-0 text-[0.9375rem] leading-relaxed">
                Der Download braucht ca. {{ formatBytes(ESTIMATED_TRANSFER_BYTES) }}. Jetzt laden
                oder vorher ins WLAN wechseln?
            </p>
        </div>

        <!-- Download Progress -->
        <div v-if="isSyncing" class="mt-6 rounded-lg bg-muted px-6 py-6 text-center">
            <Spinner class="mx-auto" />
            <p v-if="syncProgress.phase === 'songs'" class="mt-3 text-sm text-muted-foreground">
                Lieder werden geladen...
            </p>
            <p
                v-else-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                class="mt-3 text-sm tabular-nums text-muted-foreground"
            >
                {{ syncProgress.current }} von {{ syncProgress.total }} Dateien
            </p>
            <p v-else class="mt-3 text-sm text-muted-foreground">Daten werden geladen...</p>
            <Progress
                v-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                :model-value="syncProgress.current / syncProgress.total"
                class="mt-4"
            />
        </div>

        <!-- Download Complete -->
        <div
            v-if="downloadComplete && failedCount === 0"
            class="mt-6 flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-6"
        >
            <CircleCheck class="size-10 text-primary" aria-hidden="true" />
            <p class="text-center font-medium">Alle Inhalte wurden erfolgreich heruntergeladen!</p>
        </div>

        <!-- Partial Failure -->
        <div
            v-if="downloadStarted && !isSyncing && failedCount > 0"
            class="mt-6 flex flex-col items-center gap-2 rounded-lg border-l-4 border-destructive bg-destructive/10 px-6 py-6"
        >
            <CircleAlert class="size-8 text-destructive" aria-hidden="true" />
            <p class="text-center text-sm leading-relaxed text-destructive">
                {{ failedCount }} Dateien konnten nicht heruntergeladen werden. Sie können den
                Download der fehlenden Dateien erneut versuchen.
            </p>
            <Button type="button" variant="ghost" @click="$emit('retry')">Erneut versuchen</Button>
        </div>

        <!-- Error (hidden while the partial-failure block above offers the
             targeted retry — two same-labeled buttons would be ambiguous) -->
        <div
            v-if="downloadStarted && syncError && failedCount === 0"
            class="mt-6 flex flex-col items-center gap-2 rounded-lg border-l-4 border-destructive bg-destructive/10 px-6 py-6"
        >
            <CircleAlert class="size-8 text-destructive" aria-hidden="true" />
            <p class="text-center text-sm leading-relaxed text-destructive">{{ syncError }}</p>
            <Button type="button" variant="ghost" @click="$emit('download')">
                Erneut versuchen
            </Button>
        </div>

        <div class="mt-auto flex flex-col gap-2 pt-8">
            <template v-if="awaitingChoice">
                <Button type="button" size="lg" class="w-full" @click="$emit('download')">
                    <Download aria-hidden="true" />
                    Jetzt laden
                </Button>
                <!-- Leaving is not losing the download: the empty Liederliste
                     offers it again, and Einstellungen › Daten always does. -->
                <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    class="w-full text-muted-foreground"
                    @click="$emit('skip')"
                >
                    Später im WLAN
                </Button>
            </template>
            <Button
                v-if="downloadComplete"
                type="button"
                size="lg"
                class="w-full"
                @click="$emit('finish')"
            >
                Fertig
                <Check aria-hidden="true" />
            </Button>
            <!-- Escape hatch when the download failed (e.g. offline): never trap
                 the user in onboarding. -->
            <Button
                v-if="
                    downloadStarted &&
                    !isSyncing &&
                    !downloadComplete &&
                    (syncError || failedCount > 0)
                "
                type="button"
                variant="ghost"
                size="lg"
                class="w-full text-muted-foreground"
                @click="$emit('skip')"
            >
                Später fortfahren
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
    Check,
    CircleAlert,
    CircleCheck,
    CloudDownload,
    Download,
    Image,
    Music,
    Server,
    Wifi,
} from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

import { ESTIMATED_SYNC_BYTES, ESTIMATED_TRANSFER_BYTES, formatBytes } from '@/services/storage';

// Props
const props = defineProps<{
    isSyncing: boolean;
    /** The reader has asked for the download (it does not start by itself). */
    downloadStarted: boolean;
    syncError: string | null;
    syncProgress: {
        phase: string;
        current: number;
        total: number;
    };
    downloadComplete: boolean;
    failedCount: number;
    storageEstimate: { usage: number; quota: number } | null;
}>();

// Emits
defineEmits<{
    download: [];
    retry: [];
    finish: [];
    skip: [];
}>();

// Nothing asked for yet and nothing already running or done: the step is the
// question. A sync started elsewhere (a restored session) shows its progress
// instead of asking about one that is already under way.
const awaitingChoice = computed(
    () => !props.downloadStarted && !props.isSyncing && !props.downloadComplete,
);
</script>
