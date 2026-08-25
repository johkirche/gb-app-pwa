<template>
    <div class="flex h-full flex-col bg-background">
        <!-- Named for what the page can actually do right now. Without a session
             the sync is off the table, and calling the page after the one thing
             it cannot offer is how a reader ends up looking for a way out of it.
             What remains — what is stored, how much room it takes, deleting it —
             is the device's own inventory, so that is what it is called. -->
        <AppPageHeader :title="isLoggedIn ? 'Synchronisieren' : 'Heruntergeladene Inhalte'">
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
                        <h2 class="label-micro shrink-0 text-gold">
                            {{ isLoggedIn ? 'Synchronisierungsstatus' : 'Auf diesem Gerät' }}
                        </h2>
                        <Separator class="flex-1" />
                    </div>
                    <ul class="mt-1 divide-y divide-border">
                        <!-- First, because it decides what the rest of the page can
                             do. Every other line here is a number that holds true
                             either way; this is the one that changes the answer. -->
                        <li class="flex items-center gap-4 px-2 py-3">
                            <component
                                :is="isLoggedIn ? UserCheck : UserRound"
                                class="size-5 shrink-0"
                                :class="isLoggedIn ? 'text-muted-foreground' : 'text-gold'"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">
                                    {{ isLoggedIn ? 'Angemeldet' : 'Nicht angemeldet' }}
                                </p>
                                <p class="text-sm leading-relaxed text-muted-foreground">
                                    {{ sessionStatusText }}
                                </p>
                            </div>
                        </li>
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
                                <p class="text-[15px]">Notendateien (SVG &amp; MusicXML)</p>
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
                        <!-- Without a session this section is the explanation, not a
                             description of a download wrapped around a button that
                             cannot be pressed. A disabled control the reader has
                             already been told about twice only adds to the dead end. -->
                        <LoginRequiredNotice
                            v-if="!isLoggedIn"
                            title="Synchronisieren benötigt eine Anmeldung"
                        >
                            Ihre gespeicherten Lieder bleiben vollständig nutzbar. Zum Abgleich mit
                            dem Server melden Sie sich bitte erneut an, sobald Sie eine
                            Internetverbindung haben.
                        </LoginRequiredNotice>

                        <template v-else>
                            <p class="text-sm leading-relaxed text-muted-foreground">
                                Lädt alle Lieder und Notendateien vom Server herunter und speichert
                                sie lokal für die Offline-Nutzung. Bereits Geladenes wird
                                übersprungen.
                            </p>
                            <p
                                v-if="storage"
                                class="mt-2 text-sm leading-relaxed text-muted-foreground"
                            >
                                <template v-if="expectsFullDownload">
                                    Geschätzte Downloadgröße: ca.
                                    {{ formatBytes(ESTIMATED_SYNC_BYTES) }} &ndash; Freier Speicher:
                                    {{ formatBytes(freeSpace) }}
                                </template>
                                <template v-else>
                                    Es werden nur die Änderungen geladen &ndash; Freier Speicher:
                                    {{ formatBytes(freeSpace) }}
                                </template>
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
                        </template>
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
                        <template v-if="!isLoggedIn">
                            Zum Nachladen melden Sie sich bitte an.
                        </template>
                    </p>
                    <!-- This box survives restarts (the list is kept in db.meta), so
                         a reader whose session lapsed after a broken-off sync meets
                         it cold. It has to name the next step — a greyed-out retry
                         states the problem and offers nothing. -->
                    <Button
                        v-if="isLoggedIn"
                        type="button"
                        class="mt-3 w-full"
                        @click="handleRetryFailed"
                    >
                        Fehlgeschlagene erneut laden
                    </Button>
                    <Button
                        v-else
                        type="button"
                        variant="outline"
                        class="mt-3 w-full"
                        @click="router.push('/login')"
                    >
                        <LogIn aria-hidden="true" />
                        Jetzt anmelden
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

                <!-- Hints. Only worth the room while a sync is actually on offer —
                     without a session it would restate the notice above it. -->
                <section v-if="isLoggedIn">
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

import {
    Clock,
    Image,
    LogIn,
    Music,
    RefreshCw,
    Server,
    Trash2,
    UserCheck,
    UserRound,
    Wifi,
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';

import { useConfirm } from '@/composables/useConfirm';
import { useSessionAccess } from '@/composables/useSessionAccess';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';
import LoginRequiredNotice from '@/components/shell/LoginRequiredNotice.vue';
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
const { isLoggedIn, user } = useSessionAccess();
const router = useRouter();

/**
 * What the session currently is, in one line under the status heading.
 *
 * Signed in, the concrete fact is *which* account — a shared device is the whole
 * reason that matters. Signed out, the useful fact is not that something is
 * missing but what it costs: nothing offline, everything server-side. The wording
 * stays neutral about the cause, because the app genuinely cannot tell an expired
 * token from a session someone ended on purpose.
 */
const sessionStatusText = computed(() => {
    if (!isLoggedIn.value) {
        return 'Ihr Gesangbuch bleibt offline vollständig nutzbar. Zum Synchronisieren ist eine Anmeldung nötig.';
    }
    return user.value?.email || 'Ihre Sitzung ist aktiv.';
});

const songsCount = computed(() => songs.value.length);
const filesCount = ref(0);
const isDeleting = ref(false);
const storage = ref<StorageSpace | null>(null);
const updatesAvailable = ref<boolean | null>(null);

const freeSpace = computed(() =>
    storage.value ? Math.max(storage.value.quota - storage.value.usage, 0) : 0,
);

// Whether the next sync still has the whole book ahead of it. A sync only
// fetches what changed, so the ~90 MB estimate — and the free-space gate built
// on it — only speaks for a device that holds nothing yet, or one whose last
// download broke off with files missing.
const expectsFullDownload = computed(() => songsCount.value === 0 || failedFiles.value.length > 0);

// Load counts on mount
onMounted(async () => {
    await updateFilesCount();
    storage.value = await getStorageEstimate();
    // The update check is a server call like any other. Without a session it can
    // only fail, and its failure would be the second thing on the page saying so
    // — the notice above the sync button has already said it once.
    if (isLoggedIn.value) {
        updatesAvailable.value = await songsStore.checkForUpdates();
    }
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
    if (expectsFullDownload.value && storage.value && freeSpace.value < REQUIRED_FREE_BYTES) {
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
    // Without a session the downloaded book is the only copy this device can
    // reach, and getting it back needs both a sign-in and a connection. Say so
    // before it goes, not after.
    const proceed = await confirm({
        title: 'Daten löschen',
        message: isLoggedIn.value
            ? 'Möchten Sie wirklich alle lokal gespeicherten Lieder und Notendateien löschen?'
            : 'Möchten Sie wirklich alle lokal gespeicherten Lieder und Notendateien löschen? ' +
              'Sie sind derzeit nicht angemeldet – zum erneuten Herunterladen benötigen Sie eine ' +
              'Anmeldung und eine Internetverbindung.',
        confirmText: 'Löschen',
        destructive: true,
    });

    if (proceed) {
        isDeleting.value = true;
        try {
            await songsStore.clearAllData();
            await updateFilesCount();

            // The downloaded book was the only reason this device could open the
            // app without a session. With it gone there is nothing left to read,
            // so the login form is where this now belongs — going there directly
            // beats leaving the reader on an empty page until they navigate.
            if (!isLoggedIn.value) {
                router.push('/login');
            }
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
