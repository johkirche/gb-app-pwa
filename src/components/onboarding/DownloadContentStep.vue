<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <div
            class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10"
        >
            <CloudDownload class="size-10 text-primary" aria-hidden="true" />
        </div>

        <h1 class="text-center font-display text-3xl font-semibold">Inhalte herunterladen</h1>
        <p class="mt-3 text-center text-[15px] leading-relaxed text-muted-foreground">
            Das Gesangbuch wird jetzt einmalig heruntergeladen (ca. 15&nbsp;MB), damit alle Lieder
            und Noten auch ohne Internetverbindung verfügbar sind.
        </p>

        <ul class="mt-8 divide-y divide-border rounded-lg border border-border px-4">
            <li class="flex items-center gap-4 py-3">
                <Music class="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="text-[15px]">Alle Lieder und Texte</span>
            </li>
            <li class="flex items-center gap-4 py-3">
                <Image class="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="text-[15px]">Notendateien zum Offline-Lesen</span>
            </li>
            <li class="flex items-center gap-4 py-3">
                <Wifi class="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="text-[15px]">WLAN-Verbindung empfohlen</span>
            </li>
            <li v-if="storageEstimate" class="flex items-center gap-4 py-3">
                <Server class="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span class="text-[15px]">
                    Freier Speicher:
                    {{ formatBytes(storageEstimate.quota - storageEstimate.usage) }}
                </span>
            </li>
        </ul>

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
            v-if="!isSyncing && failedCount > 0"
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
            v-if="syncError && failedCount === 0"
            class="mt-6 flex flex-col items-center gap-2 rounded-lg border-l-4 border-destructive bg-destructive/10 px-6 py-6"
        >
            <CircleAlert class="size-8 text-destructive" aria-hidden="true" />
            <p class="text-center text-sm leading-relaxed text-destructive">{{ syncError }}</p>
            <Button type="button" variant="ghost" @click="$emit('download')">
                Erneut versuchen
            </Button>
        </div>

        <div class="mt-auto flex flex-col gap-2 pt-8">
            <!-- The download starts automatically (see OnboardingPage); buttons only
                 appear once there is a result to act on. -->
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
            <!-- Escape hatch when the automatic download failed (e.g. offline):
                 never trap the user in onboarding. -->
            <Button
                v-if="!isSyncing && !downloadComplete && (syncError || failedCount > 0)"
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
import {
    Check,
    CircleAlert,
    CircleCheck,
    CloudDownload,
    Image,
    Music,
    Server,
    Wifi,
} from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

import { formatBytes } from '@/services/storage';

// Props
defineProps<{
    isSyncing: boolean;
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
</script>
