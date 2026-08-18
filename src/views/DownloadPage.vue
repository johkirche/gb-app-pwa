<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Synchronisieren">
            <template #leading>
                <BackButton default-href="/tabs/einstellungen" />
            </template>
        </AppPageHeader>

        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto w-full max-w-md space-y-10 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6"
            >
                <!-- Sync Status -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Synchronisierungsstatus</h2>
                        <Separator class="flex-1" />
                    </div>
                    <ul class="mt-1 divide-y divide-border">
                        <li class="flex items-center gap-4 px-2 py-3">
                            <Music
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Lieder</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ songsCount }} Lieder gespeichert
                                </p>
                            </div>
                        </li>
                        <li class="flex items-center gap-4 px-2 py-3">
                            <Image
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Notendateien (PNG)</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ filesCount }} Dateien gespeichert
                                </p>
                            </div>
                        </li>
                        <li v-if="storage" class="flex items-center gap-4 px-2 py-3">
                            <Server
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Speicherplatz</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ formatBytes(storage.usage) }} von
                                    {{ formatBytes(storage.quota) }} belegt
                                </p>
                            </div>
                        </li>
                        <li v-if="lastSyncTime" class="flex items-center gap-4 px-2 py-3">
                            <Clock
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Letzte Synchronisierung</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ formatSyncTime(lastSyncTime) }}
                                </p>
                            </div>
                        </li>
                        <li
                            v-if="updatesAvailable === true"
                            class="flex items-center gap-4 px-2 py-3"
                        >
                            <RefreshCw class="size-5 shrink-0 text-gold" aria-hidden="true" />
                            <p class="text-sm leading-relaxed text-muted-foreground">
                                Neue Inhalte verfügbar. Bitte synchronisieren Sie erneut.
                            </p>
                        </li>
                    </ul>
                    <Separator />
                </section>

                <!-- Sync Action -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Synchronisierung</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-4 px-2">
                        <p class="text-sm leading-relaxed text-muted-foreground">
                            Lädt alle Lieder und Notendateien vom Server herunter und speichert sie
                            lokal für die Offline-Nutzung.
                        </p>
                        <p
                            v-if="storage"
                            class="mt-2 text-sm leading-relaxed text-muted-foreground"
                        >
                            Geschätzte Downloadgröße: ca.
                            {{ formatBytes(ESTIMATED_SYNC_BYTES) }} &ndash; Freier Speicher:
                            {{ formatBytes(freeSpace) }}
                        </p>
                        <Button
                            type="button"
                            size="lg"
                            class="mt-5 w-full"
                            :disabled="isSyncing"
                            @click="handleSync"
                        >
                            <RefreshCw aria-hidden="true" />
                            Jetzt synchronisieren
                        </Button>
                    </div>
                </section>

                <!-- Progress (shown during sync) -->
                <section v-if="isSyncing">
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Wird synchronisiert...</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-4 rounded-lg bg-muted px-6 py-6 text-center">
                        <Spinner class="mx-auto" />
                        <p
                            v-if="syncProgress.phase === 'songs'"
                            class="mt-3 text-sm text-muted-foreground"
                        >
                            Lieder werden geladen...
                        </p>
                        <p
                            v-else-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                            class="mt-3 text-sm tabular-nums text-muted-foreground"
                        >
                            {{ syncProgress.current }} von {{ syncProgress.total }} Dateien
                            heruntergeladen
                        </p>
                        <p v-else class="mt-3 text-sm text-muted-foreground">
                            Daten werden geladen...
                        </p>
                        <Progress
                            v-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                            :model-value="syncProgress.current / syncProgress.total"
                            class="mt-4"
                        />
                    </div>
                </section>

                <!-- Partial Failure -->
                <section
                    v-if="!isSyncing && failedFiles.length > 0"
                    class="rounded-lg border-l-4 border-gold bg-gold/10 px-4 py-4"
                >
                    <h2 class="font-medium">Unvollständige Synchronisierung</h2>
                    <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {{ failedFiles.length }} Dateien konnten nicht heruntergeladen werden. Diese
                        Noten sind offline nicht verfügbar.
                    </p>
                    <Button type="button" class="mt-3 w-full" @click="handleRetryFailed">
                        Fehlgeschlagene erneut laden
                    </Button>
                </section>

                <!-- Error -->
                <section
                    v-if="error"
                    class="rounded-lg border-l-4 border-destructive bg-destructive/10 px-4 py-4"
                >
                    <h2 class="font-medium text-destructive">Fehler</h2>
                    <p class="mt-1 text-sm leading-relaxed text-destructive">{{ error }}</p>
                </section>

                <!-- Hints -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Hinweise</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-3 flex items-start gap-4 px-2">
                        <Wifi class="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
                        <p class="text-sm leading-relaxed text-muted-foreground">
                            Für die Synchronisierung wird eine Internetverbindung benötigt. Der
                            Download kann je nach Verbindung einige Minuten dauern.
                        </p>
                    </div>
                </section>

                <!-- Delete Data -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Daten löschen</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-4 px-2">
                        <p class="text-sm leading-relaxed text-muted-foreground">
                            Löscht alle lokal gespeicherten Lieder und Notendateien. Diese können
                            jederzeit erneut synchronisiert werden.
                        </p>
                        <Button
                            type="button"
                            variant="destructive"
                            size="lg"
                            class="mt-5 w-full"
                            :disabled="
                                isSyncing || isDeleting || (songsCount === 0 && filesCount === 0)
                            "
                            @click="handleDelete"
                        >
                            <Trash2 aria-hidden="true" />
                            Alle Daten löschen
                        </Button>
                    </div>
                </section>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Clock, Image, Music, RefreshCw, Server, Trash2, Wifi } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';

import { useSongsStore } from '@/stores/songs';

import { useConfirm } from '@/composables/useConfirm';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

import {
    ESTIMATED_SYNC_BYTES,
    REQUIRED_FREE_BYTES,
    type StorageSpace,
    formatBytes,
    getStorageEstimate,
} from '@/services/storage';

const songsStore = useSongsStore();
const { isSyncing, error, lastSyncTime, syncProgress, songs, failedFiles } =
    storeToRefs(songsStore);
const { confirm } = useConfirm();

const songsCount = computed(() => songs.value.length);
const filesCount = ref(0);
const isDeleting = ref(false);
const storage = ref<StorageSpace | null>(null);
const updatesAvailable = ref<boolean | null>(null);

const freeSpace = computed(() =>
    storage.value ? Math.max(storage.value.quota - storage.value.usage, 0) : 0,
);

// Load counts on mount
onMounted(async () => {
    await updateFilesCount();
    storage.value = await getStorageEstimate();
    updatesAvailable.value = await songsStore.checkForUpdates();
});

async function updateFilesCount() {
    filesCount.value = await songsStore.getStoredFilesCount();
}

async function refreshStorageEstimate() {
    storage.value = await getStorageEstimate();
}

// Warn before syncing when the estimated download clearly exceeds the free space
function confirmLowStorage(): Promise<boolean> {
    return confirm({
        title: 'Wenig Speicherplatz',
        message:
            `Der Download benötigt schätzungsweise ${formatBytes(ESTIMATED_SYNC_BYTES)}, ` +
            `es sind aber nur noch ${formatBytes(freeSpace.value)} frei. Die Synchronisierung ` +
            'wird möglicherweise nicht vollständig abgeschlossen. Möchten Sie trotzdem fortfahren?',
        confirmText: 'Trotzdem fortfahren',
    });
}

async function handleSync() {
    storage.value = await getStorageEstimate();
    if (storage.value && freeSpace.value < REQUIRED_FREE_BYTES) {
        const proceed = await confirmLowStorage();
        if (!proceed) return;
    }

    try {
        await songsStore.syncAll();
        if (songsStore.failedFiles.length === 0) {
            updatesAvailable.value = false;
        }
    } catch (err) {
        console.error('Sync failed:', err);
    } finally {
        await updateFilesCount();
        await refreshStorageEstimate();
    }
}

async function handleRetryFailed() {
    try {
        await songsStore.retryFailedFiles();
    } catch (err) {
        console.error('Retry failed:', err);
    } finally {
        await updateFilesCount();
        await refreshStorageEstimate();
    }
}

async function handleDelete() {
    const proceed = await confirm({
        title: 'Daten löschen',
        message: 'Möchten Sie wirklich alle lokal gespeicherten Lieder und Notendateien löschen?',
        confirmText: 'Löschen',
        destructive: true,
    });

    if (proceed) {
        isDeleting.value = true;
        try {
            await songsStore.clearAllData();
            await updateFilesCount();
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            isDeleting.value = false;
            await refreshStorageEstimate();
        }
    }
}

function formatSyncTime(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}
</script>
