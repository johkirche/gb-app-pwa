<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-button @click="$router.back()">
                        <ion-icon slot="icon-only" :icon="arrowBackOutline"></ion-icon>
                    </ion-button>
                </ion-buttons>
                <ion-title>Synchronisieren</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true">
            <div class="content-container card-stack">
                <!-- Sync Status Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Synchronisierungsstatus</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <ion-list class="transparent">
                            <ion-item class="transparent">
                                <ion-icon :icon="musicalNotesOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Lieder</h3>
                                    <p>{{ songsCount }} Lieder gespeichert</p>
                                </ion-label>
                            </ion-item>
                            <ion-item class="transparent">
                                <ion-icon :icon="imageOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Notendateien (PNG)</h3>
                                    <p>{{ filesCount }} Dateien gespeichert</p>
                                </ion-label>
                            </ion-item>
                            <ion-item v-if="storage" class="transparent">
                                <ion-icon :icon="serverOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Speicherplatz</h3>
                                    <p>
                                        {{ formatBytes(storage.usage) }} von
                                        {{ formatBytes(storage.quota) }} belegt
                                    </p>
                                </ion-label>
                            </ion-item>
                            <ion-item v-if="lastSyncTime" class="transparent">
                                <ion-icon :icon="timeOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Letzte Synchronisierung</h3>
                                    <p>{{ formatSyncTime(lastSyncTime) }}</p>
                                </ion-label>
                            </ion-item>
                            <ion-item v-if="updatesAvailable === true" class="transparent">
                                <ion-icon
                                    :icon="syncOutline"
                                    slot="start"
                                    color="warning"
                                ></ion-icon>
                                <ion-label class="ion-text-wrap">
                                    <p>Neue Inhalte verfügbar. Bitte synchronisieren Sie erneut.</p>
                                </ion-label>
                            </ion-item>
                        </ion-list>
                    </ion-card-content>
                </ion-card>

                <!-- Sync Actions Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Synchronisierung</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p class="sync-description">
                            Lädt alle Lieder und Notendateien vom Server herunter und speichert sie
                            lokal für die Offline-Nutzung.
                        </p>
                        <p v-if="storage" class="sync-description">
                            Geschätzte Downloadgröße: ca.
                            {{ formatBytes(ESTIMATED_SYNC_BYTES) }} &ndash; Freier Speicher:
                            {{ formatBytes(freeSpace) }}
                        </p>

                        <ion-button
                            expand="block"
                            color="primary"
                            @click="handleSync"
                            :disabled="isSyncing"
                            size="large"
                        >
                            <ion-icon slot="start" :icon="syncOutline"></ion-icon>
                            Jetzt synchronisieren
                        </ion-button>
                    </ion-card-content>
                </ion-card>

                <!-- Progress Card (shown during sync) -->
                <ion-card v-if="isSyncing">
                    <ion-card-header>
                        <ion-card-title>Wird synchronisiert...</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <div class="state-container--inline">
                            <ion-spinner name="crescent"></ion-spinner>
                            <p
                                v-if="syncProgress.phase === 'songs'"
                                class="ion-no-margin ion-text-center"
                            >
                                Lieder werden geladen...
                            </p>
                            <p
                                v-else-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                                class="ion-no-margin ion-text-center"
                            >
                                {{ syncProgress.current }} von {{ syncProgress.total }} Dateien
                                heruntergeladen
                            </p>
                            <p v-else class="ion-no-margin ion-text-center">
                                Daten werden geladen...
                            </p>
                            <ion-progress-bar
                                v-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                                :value="syncProgress.current / syncProgress.total"
                            ></ion-progress-bar>
                        </div>
                    </ion-card-content>
                </ion-card>

                <!-- Partial Failure Card -->
                <ion-card v-if="!isSyncing && failedFiles.length > 0" color="warning">
                    <ion-card-header>
                        <ion-card-title>Unvollständige Synchronisierung</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p class="failed-description">
                            {{ failedFiles.length }} Dateien konnten nicht heruntergeladen werden.
                            Diese Noten sind offline nicht verfügbar.
                        </p>
                        <ion-button expand="block" @click="handleRetryFailed">
                            Fehlgeschlagene erneut laden
                        </ion-button>
                    </ion-card-content>
                </ion-card>

                <!-- Error Card -->
                <ion-card v-if="error" color="danger">
                    <ion-card-header>
                        <ion-card-title>Fehler</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p>{{ error }}</p>
                    </ion-card-content>
                </ion-card>

                <!-- Info Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Hinweise</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <ion-list class="transparent">
                            <ion-item lines="none" class="transparent">
                                <ion-icon
                                    :icon="wifiOutline"
                                    slot="start"
                                    color="warning"
                                ></ion-icon>
                                <ion-label class="ion-text-wrap">
                                    <p>
                                        Für die Synchronisierung wird eine Internetverbindung
                                        benötigt. Der Download kann je nach Verbindung einige
                                        Minuten dauern.
                                    </p>
                                </ion-label>
                            </ion-item>
                        </ion-list>
                    </ion-card-content>
                </ion-card>

                <!-- Delete Data Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Daten löschen</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p class="sync-description">
                            Löscht alle lokal gespeicherten Lieder und Notendateien. Diese können
                            jederzeit erneut synchronisiert werden.
                        </p>

                        <ion-button
                            expand="block"
                            color="danger"
                            @click="handleDelete"
                            :disabled="
                                isSyncing || isDeleting || (songsCount === 0 && filesCount === 0)
                            "
                            size="large"
                        >
                            <ion-icon slot="start" :icon="trashOutline"></ion-icon>
                            Alle Daten löschen
                        </ion-button>
                    </ion-card-content>
                </ion-card>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonProgressBar,
    IonSpinner,
    IonTitle,
    IonToolbar,
    alertController,
} from '@ionic/vue';
import {
    arrowBackOutline,
    imageOutline,
    musicalNotesOutline,
    serverOutline,
    syncOutline,
    timeOutline,
    trashOutline,
    wifiOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';

import { useSongsStore } from '@/stores/songs';

import {
    ESTIMATED_SYNC_BYTES,
    type StorageSpace,
    formatBytes,
    getStorageEstimate,
} from '@/services/storage';

const songsStore = useSongsStore();
const { isSyncing, error, lastSyncTime, syncProgress, songs, failedFiles } =
    storeToRefs(songsStore);

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
async function confirmLowStorage(): Promise<boolean> {
    const alert = await alertController.create({
        header: 'Wenig Speicherplatz',
        message:
            `Der Download benötigt schätzungsweise ${formatBytes(ESTIMATED_SYNC_BYTES)}, ` +
            `es sind aber nur noch ${formatBytes(freeSpace.value)} frei. Die Synchronisierung ` +
            'wird möglicherweise nicht vollständig abgeschlossen. Möchten Sie trotzdem fortfahren?',
        buttons: [
            {
                text: 'Abbrechen',
                role: 'cancel',
            },
            {
                text: 'Trotzdem fortfahren',
                role: 'confirm',
            },
        ],
    });
    await alert.present();

    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
}

async function handleSync() {
    storage.value = await getStorageEstimate();
    if (storage.value && freeSpace.value < ESTIMATED_SYNC_BYTES) {
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
    const alert = await alertController.create({
        header: 'Daten löschen',
        message: 'Möchten Sie wirklich alle lokal gespeicherten Lieder und Notendateien löschen?',
        buttons: [
            {
                text: 'Abbrechen',
                role: 'cancel',
            },
            {
                text: 'Löschen',
                role: 'destructive',
            },
        ],
    });
    await alert.present();

    const { role } = await alert.onDidDismiss();

    if (role === 'destructive') {
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

<style scoped>
.sync-description {
    color: var(--ion-color-medium);
    line-height: 1.6;
    margin-bottom: var(--spacing-md);
}

.failed-description {
    line-height: 1.6;
    margin-bottom: var(--spacing-md);
}
</style>
