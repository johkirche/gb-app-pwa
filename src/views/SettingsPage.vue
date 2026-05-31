<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-button @click="$router.back()">
                        <ion-icon slot="icon-only" :icon="arrowBackOutline"></ion-icon>
                    </ion-button>
                </ion-buttons>
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
                                <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                            </ion-item>

                            <ion-item
                                v-if="isLoggedIn"
                                class="transparent"
                                button
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
                            <ion-item class="transparent">
                                <ion-icon :icon="contrastOutline" slot="start"></ion-icon>
                                <ion-label>Farbschema</ion-label>
                                <ion-select v-model="themeMode" @ionChange="onThemeChange">
                                    <ion-select-option value="system">System</ion-select-option>
                                    <ion-select-option value="light">Hell</ion-select-option>
                                    <ion-select-option value="dark">Dunkel</ion-select-option>
                                </ion-select>
                            </ion-item>

                            <ion-item class="transparent">
                                <ion-icon :icon="textOutline" slot="start"></ion-icon>
                                <ion-label>Textgröße (Lieder)</ion-label>
                                <ion-select v-model="songFontSize">
                                    <ion-select-option value="small">Klein</ion-select-option>
                                    <ion-select-option value="medium">Normal</ion-select-option>
                                    <ion-select-option value="large">Groß</ion-select-option>
                                    <ion-select-option value="xlarge">Sehr groß</ion-select-option>
                                </ion-select>
                            </ion-item>

                            <ion-item class="transparent">
                                <ion-icon :icon="imageOutline" slot="start"></ion-icon>
                                <ion-label>Notenansicht</ion-label>
                                <ion-select v-model="melodyDisplayMode">
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
                                <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
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
                                <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                            </ion-item>
                        </ion-list>
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
                                href="mailto:support@johannische-kirche.org"
                            >
                                <ion-icon :icon="mailOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Kontakt & Hilfe</h3>
                                    <p>support@johannische-kirche.org</p>
                                </ion-label>
                                <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                            </ion-item>

                            <ion-item class="transparent" button @click="openPrivacyPolicy">
                                <ion-icon :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
                                <ion-label>
                                    <h3>Datenschutz</h3>
                                </ion-label>
                                <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
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
    IonRange,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    alertController,
    toastController,
} from '@ionic/vue';
import {
    arrowBackOutline,
    chevronForwardOutline,
    cloudDownloadOutline,
    contrastOutline,
    createOutline,
    imageOutline,
    informationCircleOutline,
    logOutOutline,
    mailOutline,
    musicalNoteOutline,
    personOutline,
    phonePortraitOutline,
    shieldCheckmarkOutline,
    textOutline,
    trashOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';

import { usePreferencesStore } from '@/stores/preferences';
import { useSongsStore } from '@/stores/songs';

import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { user, logout, isLoggedIn } = useAuth();
const songsStore = useSongsStore();
const preferencesStore = usePreferencesStore();

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
    await updateFilesCount();
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

async function handleLogout() {
    const alert = await alertController.create({
        header: 'Abmelden',
        message: 'Möchten Sie sich wirklich abmelden?',
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
                    try {
                        // TODO: Implement API call to delete account on server
                        const toast = await toastController.create({
                            message:
                                'Kontolöschung wird in einer zukünftigen Version verfügbar sein. Bitte kontaktieren Sie den Support.',
                            duration: 4000,
                            position: 'bottom',
                            color: 'warning',
                        });
                        await toast.present();
                    } catch (error) {
                        console.error('Error deleting account:', error);
                    }
                },
            },
        ],
    });
    await alert.present();
}

function openPrivacyPolicy() {
    // Open privacy policy - could be an external link or internal page
    window.open('https://johannische-kirche.org/datenschutz', '_blank');
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
