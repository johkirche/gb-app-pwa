<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-title>Einstellungen</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true">
            <div class="content-container card-stack">
                <!-- Account Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Konto</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <ion-list class="transparent" lines="full">
                            <ion-item class="transparent">
                                <ion-icon :icon="personOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>E-Mail</h3>
                                    <p>{{ user?.email || 'Nicht angemeldet' }}</p>
                                </ion-label>
                            </ion-item>

                            <ion-item class="transparent" button @click="openEditNameModal">
                                <ion-icon :icon="createOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Name</h3>
                                    <p>{{ displayName }}</p>
                                </ion-label>
                            </ion-item>

                            <ion-item
                                v-if="isLoggedIn"
                                class="transparent"
                                button
                                :detail="false"
                                @click="handleLogout"
                            >
                                <ion-icon
                                    :icon="logOutOutline"
                                    slot="start"
                                    color="danger"
                                ></ion-icon>
                                <ion-label color="danger">
                                    <h3>Abmelden</h3>
                                </ion-label>
                            </ion-item>
                        </ion-list>
                    </ion-card-content>
                </ion-card>

                <!-- Appearance Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Darstellung</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <ion-list class="transparent" lines="full">
                            <ion-item class="transparent" lines="none">
                                <ion-icon :icon="contrastOutline" slot="start"></ion-icon>
                                <ion-label>Farbschema</ion-label>
                            </ion-item>
                            <ion-item class="transparent">
                                <ion-segment v-model="themeMode" @ionChange="onThemeChange">
                                    <ion-segment-button value="system">
                                        <ion-label>System</ion-label>
                                    </ion-segment-button>
                                    <ion-segment-button value="light">
                                        <ion-label>Hell</ion-label>
                                    </ion-segment-button>
                                    <ion-segment-button value="dark">
                                        <ion-label>Dunkel</ion-label>
                                    </ion-segment-button>
                                </ion-segment>
                            </ion-item>

                            <ion-item class="transparent">
                                <ion-icon :icon="textOutline" slot="start"></ion-icon>
                                <ion-label>Textgröße (Lieder)</ion-label>
                                <ion-select
                                    v-model="songFontSize"
                                    interface="action-sheet"
                                    cancel-text="Abbrechen"
                                    :interface-options="{ header: 'Textgröße (Lieder)' }"
                                >
                                    <ion-select-option value="small">Klein</ion-select-option>
                                    <ion-select-option value="medium">Normal</ion-select-option>
                                    <ion-select-option value="large">Groß</ion-select-option>
                                    <ion-select-option value="xlarge">Sehr groß</ion-select-option>
                                </ion-select>
                            </ion-item>

                            <ion-item class="transparent">
                                <ion-icon :icon="imageOutline" slot="start"></ion-icon>
                                <ion-label>Notenansicht</ion-label>
                                <ion-select
                                    v-model="melodyDisplayMode"
                                    interface="action-sheet"
                                    cancel-text="Abbrechen"
                                    :interface-options="{ header: 'Notenansicht' }"
                                >
                                    <ion-select-option value="image">Notenbild</ion-select-option>
                                    <ion-select-option value="xml">MusicXML</ion-select-option>
                                </ion-select>
                            </ion-item>

                            <ion-item class="transparent">
                                <ion-icon :icon="musicalNoteOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Notengröße</h3>
                                    <p>{{ Math.round(notationScale * 100) }}%</p>
                                </ion-label>
                            </ion-item>
                            <ion-item class="transparent" lines="none">
                                <ion-range
                                    :min="0.5"
                                    :max="2.0"
                                    :step="0.1"
                                    v-model="notationScale"
                                    :pin="true"
                                    :pin-formatter="
                                        (value: number) => `${Math.round(value * 100)}%`
                                    "
                                >
                                    <ion-label slot="start">50%</ion-label>
                                    <ion-label slot="end">200%</ion-label>
                                </ion-range>
                            </ion-item>
                        </ion-list>
                    </ion-card-content>
                </ion-card>

                <!-- Data Management Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Daten</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <ion-list class="transparent" lines="full">
                            <ion-item class="transparent" button @click="navigateToDownload">
                                <ion-icon :icon="cloudDownloadOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Heruntergeladene Inhalte</h3>
                                    <p>{{ songsCount }} Lieder, {{ filesCount }} Dateien</p>
                                </ion-label>
                            </ion-item>
                            <ion-item class="transparent">
                                <ion-icon :icon="serverOutline" slot="start"></ion-icon>
                                <ion-label class="ion-text-wrap">
                                    <h3>Dauerhafte Speicherung</h3>
                                    <p>{{ persistedStatusText }}</p>
                                </ion-label>
                            </ion-item>
                            <ion-item
                                class="transparent"
                                button
                                :detail="false"
                                @click="handleExport"
                            >
                                <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Daten exportieren</h3>
                                    <p>Playlists und Favoriten als Datei sichern</p>
                                </ion-label>
                            </ion-item>
                            <ion-item
                                class="transparent"
                                button
                                :detail="false"
                                @click="importInput?.click()"
                            >
                                <ion-icon :icon="cloudUploadOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Daten importieren</h3>
                                    <p>Aus einer Sicherungsdatei wiederherstellen</p>
                                </ion-label>
                            </ion-item>
                            <ion-item
                                class="transparent"
                                button
                                lines="none"
                                @click="navigateToInstallPWA"
                            >
                                <ion-icon :icon="phonePortraitOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>App installieren</h3>
                                    <p>Installiere die App auf deinem Gerät</p>
                                </ion-label>
                            </ion-item>
                        </ion-list>
                        <input
                            ref="importInput"
                            type="file"
                            accept="application/json,.json"
                            style="display: none"
                            @change="onImportFileChange"
                        />
                    </ion-card-content>
                </ion-card>

                <!-- Danger Zone Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title color="danger">Gefahrenbereich</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p class="settings-description">
                            Diese Aktionen können nicht rückgängig gemacht werden.
                        </p>
                        <ion-button
                            expand="block"
                            color="danger"
                            fill="outline"
                            @click="handleDeleteAccount"
                        >
                            <ion-icon slot="start" :icon="trashOutline"></ion-icon>
                            Konto löschen
                        </ion-button>
                    </ion-card-content>
                </ion-card>

                <!-- About Card -->
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Über die App</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <ion-list class="transparent" lines="full">
                            <ion-item class="transparent">
                                <ion-icon :icon="informationCircleOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Version</h3>
                                    <p>{{ appVersion }}</p>
                                </ion-label>
                            </ion-item>

                            <ion-item
                                class="transparent"
                                button
                                :detail="false"
                                :href="`mailto:${SUPPORT_EMAIL}`"
                            >
                                <ion-icon :icon="mailOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Kontakt & Hilfe</h3>
                                    <p>{{ SUPPORT_EMAIL }}</p>
                                </ion-label>
                            </ion-item>

                            <ion-item class="transparent" button @click="openPrivacyPolicy">
                                <ion-icon :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Datenschutz</h3>
                                </ion-label>
                            </ion-item>

                            <ion-item
                                class="transparent"
                                button
                                lines="none"
                                @click="router.push('/impressum')"
                            >
                                <ion-icon :icon="documentTextOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Impressum</h3>
                                </ion-label>
                            </ion-item>
                        </ion-list>
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
    IonRange,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    alertController,
    onIonViewWillEnter,
    toastController,
} from '@ionic/vue';
import {
    cloudDownloadOutline,
    cloudUploadOutline,
    contrastOutline,
    createOutline,
    documentTextOutline,
    downloadOutline,
    imageOutline,
    informationCircleOutline,
    logOutOutline,
    mailOutline,
    musicalNoteOutline,
    personOutline,
    phonePortraitOutline,
    serverOutline,
    shieldCheckmarkOutline,
    textOutline,
    trashOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';

import { useFavoritesStore } from '@/stores/favorites';
import { usePlaylistsStore } from '@/stores/playlists';
import { usePreferencesStore } from '@/stores/preferences';
import { useSongsStore } from '@/stores/songs';

import { useAuth } from '@/composables/useAuth';

import { SUPPORT_EMAIL } from '@/config/support';
import { type Favorite, type Playlist, db } from '@/db';
import { downloadJsonFile, isPersisted } from '@/services/storage';

const router = useRouter();
const { user, logout, deleteAccount, isLoggedIn } = useAuth();
const songsStore = useSongsStore();
const preferencesStore = usePreferencesStore();
const playlistsStore = usePlaylistsStore();
const favoritesStore = useFavoritesStore();

// Hidden file input for the backup import
const importInput = ref<HTMLInputElement | null>(null);

// App version - could be pulled from package.json in a real setup
const appVersion = ref('1.0.0');

// Appearance settings
const themeMode = ref<'system' | 'light' | 'dark'>('system');
const songFontSize = computed({
    get: () => preferencesStore.textSize,
    set: (value) => preferencesStore.setTextSize(value),
});
const notationScale = computed({
    get: () => preferencesStore.notationScale,
    set: (value) => preferencesStore.setNotationScale(value),
});
const melodyDisplayMode = computed({
    get: () => preferencesStore.melodyDisplayMode,
    set: (value) => preferencesStore.setMelodyDisplayMode(value),
});

// Data counts
const songsCount = computed(() => songsStore.songs.length);
const filesCount = ref(0);

// Persistent-storage state: true/false from the browser, null = unsupported
const persistentStorage = ref<boolean | null>(null);
const persistedStatusText = computed(() => {
    if (persistentStorage.value === true) {
        return 'Aktiv – Ihre Daten sind vor automatischer Löschung geschützt.';
    }
    if (persistentStorage.value === false) {
        return 'Nicht aktiv – der Browser kann lokale Daten bei Speicherplatzmangel entfernen.';
    }
    return 'Vom Browser nicht unterstützt.';
});

// Computed
const displayName = computed(() => {
    if (user.value?.firstName || user.value?.lastName) {
        return [user.value.firstName, user.value.lastName].filter(Boolean).join(' ');
    }
    return 'Nicht angegeben';
});

// Load settings on mount
onMounted(async () => {
    await loadSettings();
});

// As a tab child this page mounts once and stays alive across tab switches, so
// volatile values (files count after a sync, persistence state) must refresh on
// every entry — onMounted alone would show stale data until a full reload.
onIonViewWillEnter(async () => {
    await updateFilesCount();
    persistentStorage.value = await isPersisted();
});

async function loadSettings() {
    // Load theme preference
    const savedTheme = localStorage.getItem('settings.theme');
    if (savedTheme && ['system', 'light', 'dark'].includes(savedTheme)) {
        themeMode.value = savedTheme as 'system' | 'light' | 'dark';
    }

    // Preferences store loads automatically, no need to load here
    // Apply theme
    applyTheme(themeMode.value);
}

async function updateFilesCount() {
    filesCount.value = await songsStore.getStoredFilesCount();
}

function onThemeChange() {
    localStorage.setItem('settings.theme', themeMode.value);
    applyTheme(themeMode.value);
}

function applyTheme(theme: 'system' | 'light' | 'dark') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (theme === 'dark' || (theme === 'system' && prefersDark)) {
        document.documentElement.classList.add('ion-palette-dark');
    } else {
        document.documentElement.classList.remove('ion-palette-dark');
    }
}

function navigateToDownload() {
    router.push('/download');
}

function navigateToInstallPWA() {
    router.push('/install-pwa');
}

async function openEditNameModal() {
    const alert = await alertController.create({
        header: 'Name ändern',
        inputs: [
            {
                name: 'firstName',
                type: 'text',
                placeholder: 'Vorname',
                value: user.value?.firstName || '',
            },
            {
                name: 'lastName',
                type: 'text',
                placeholder: 'Nachname',
                value: user.value?.lastName || '',
            },
        ],
        buttons: [
            {
                text: 'Abbrechen',
                role: 'cancel',
            },
            {
                text: 'Speichern',
                handler: async (data) => {
                    await updateUserName(data.firstName, data.lastName);
                },
            },
        ],
    });
    await alert.present();
}

async function updateUserName(_firstName: string, _lastName: string) {
    try {
        // TODO: Implement API call to update user name on server
        // For now, show a toast that the feature is coming
        const toast = await toastController.create({
            message: 'Name-Änderung wird in einer zukünftigen Version verfügbar sein.',
            duration: 3000,
            position: 'bottom',
            color: 'warning',
        });
        await toast.present();
    } catch (error) {
        console.error('Error updating name:', error);
    }
}

async function showToast(message: string, color: 'success' | 'danger') {
    const toast = await toastController.create({
        message,
        duration: 3000,
        position: 'bottom',
        color,
    });
    await toast.present();
}

async function handleExport() {
    try {
        const [playlists, favorites] = await Promise.all([
            db.playlists.toArray(),
            db.favorites.toArray(),
        ]);
        downloadJsonFile(`gesangbuch-daten-${new Date().toISOString().slice(0, 10)}.json`, {
            app: 'gesangbuch',
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            playlists,
            favorites,
        });
        await showToast('Daten wurden exportiert.', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        await showToast('Die Daten konnten nicht exportiert werden.', 'danger');
    }
}

// Revive a JSON-serialized Date (ISO string) back into a real Date object
function reviveDate(value: unknown): Date {
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function onImportFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
        const data = JSON.parse(await file.text());
        if (
            data?.app !== 'gesangbuch' ||
            !Array.isArray(data.playlists) ||
            !Array.isArray(data.favorites)
        ) {
            throw new Error('invalid backup file');
        }

        const playlists: Playlist[] = data.playlists
            .filter(
                (p: unknown) =>
                    p &&
                    typeof (p as Playlist).id === 'string' &&
                    typeof (p as Playlist).name === 'string' &&
                    Array.isArray((p as Playlist).songIds),
            )
            .map((p: Playlist & { createdAt: string | Date; updatedAt: string | Date }) => ({
                id: p.id,
                name: p.name,
                emoji: typeof p.emoji === 'string' ? p.emoji : '🎵',
                songIds: p.songIds.filter((s: unknown): s is string => typeof s === 'string'),
                createdAt: reviveDate(p.createdAt),
                updatedAt: reviveDate(p.updatedAt),
            }));

        const favorites: Favorite[] = data.favorites
            .filter((f: unknown) => f && typeof (f as Favorite).id === 'string')
            .map((f: Favorite & { createdAt: string | Date }) => ({
                id: f.id,
                createdAt: reviveDate(f.createdAt),
            }));

        // bulkPut matches on the primary keys (playlist id = UUID, favorite id
        // = song id), so re-importing the same backup is idempotent — existing
        // rows are overwritten, never duplicated.
        await db.transaction('rw', db.playlists, db.favorites, async () => {
            await db.playlists.bulkPut(playlists);
            await db.favorites.bulkPut(favorites);
        });

        // Both stores hydrate their refs only once at creation — reload them
        await Promise.all([playlistsStore.loadPlaylists(), favoritesStore.loadFavorites()]);

        await showToast(
            `${playlists.length} Playlists und ${favorites.length} Favoriten importiert.`,
            'success',
        );
    } catch (error) {
        console.error('Error importing data:', error);
        await showToast(
            'Die Datei konnte nicht importiert werden. Bitte wählen Sie eine gültige Sicherungsdatei.',
            'danger',
        );
    }
}

async function handleLogout() {
    const alert = await alertController.create({
        header: 'Abmelden',
        message:
            'Möchten Sie sich wirklich abmelden? Ihre Playlists, Favoriten und Einstellungen werden dabei von diesem Gerät gelöscht.',
        buttons: [
            {
                text: 'Abbrechen',
                role: 'cancel',
            },
            {
                text: 'Abmelden',
                handler: async () => {
                    await logout();
                    router.push('/login');
                },
            },
        ],
    });
    await alert.present();
}

async function handleDeleteAccount() {
    const alert = await alertController.create({
        header: 'Konto löschen',
        message:
            'Sind Sie sicher, dass Sie Ihr Konto unwiderruflich löschen möchten? Alle Ihre Daten werden gelöscht.',
        buttons: [
            {
                text: 'Abbrechen',
                role: 'cancel',
            },
            {
                text: 'Konto löschen',
                role: 'destructive',
                handler: async () => {
                    const result = await deleteAccount();
                    if (result.success) {
                        // deleteAccount already wiped this device and is
                        // hard-redirecting to /login — nothing left to do here.
                        return;
                    }

                    if (result.code === 'FORBIDDEN') {
                        // Automatic deletion is not enabled on the server (yet):
                        // offer the honest route via the support address instead.
                        const infoAlert = await alertController.create({
                            header: 'Kontolöschung nicht möglich',
                            message: result.error,
                            buttons: [
                                {
                                    text: 'Schließen',
                                    role: 'cancel',
                                },
                                {
                                    text: 'E-Mail schreiben',
                                    handler: () => {
                                        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Kontolöschung')}`;
                                    },
                                },
                            ],
                        });
                        await infoAlert.present();
                    } else {
                        await showToast(result.error, 'danger');
                    }
                },
            },
        ],
    });
    await alert.present();
}

function openPrivacyPolicy() {
    router.push('/datenschutz');
}
</script>

<style scoped>
.settings-description {
    color: var(--ion-color-medium);
    line-height: 1.6;
    margin-bottom: var(--spacing-md);
    font-size: var(--font-size-sm);
}

ion-range {
    --bar-background: var(--ion-color-light);
    --bar-background-active: var(--ion-color-primary);
    --knob-background: var(--ion-color-primary);
    --knob-size: 20px;
    --pin-background: var(--ion-color-primary);
    padding: 8px 0;
}

ion-range ion-label {
    font-size: 0.75rem;
    color: var(--ion-color-medium);
}
</style>
