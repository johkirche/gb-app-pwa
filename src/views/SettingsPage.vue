<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Einstellungen" />

        <main ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="page-col space-y-10 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
                <!-- Konto -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Konto</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-1 divide-y divide-border">
                        <div class="flex items-center gap-4 px-2 py-3">
                            <User
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">E-Mail</p>
                                <p class="truncate text-sm text-muted-foreground">
                                    {{ user?.email || 'Nicht angemeldet' }}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="openEditNameModal"
                        >
                            <SquarePen
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Name</p>
                                <p class="truncate text-sm text-muted-foreground">
                                    {{ displayName }}
                                </p>
                            </div>
                        </button>

                        <button
                            v-if="isLoggedIn"
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="handleLogout"
                        >
                            <LogOut class="size-5 shrink-0 text-destructive" aria-hidden="true" />
                            <p class="text-[15px] text-destructive">Abmelden</p>
                        </button>
                    </div>
                    <Separator />
                </section>

                <!-- Darstellung -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Darstellung</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-1 divide-y divide-border">
                        <div class="px-2 py-3">
                            <div class="flex items-center gap-4">
                                <Contrast
                                    class="size-5 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <p class="text-[15px]">Farbschema</p>
                            </div>
                            <ToggleGroup
                                type="single"
                                class="mt-3 flex w-full"
                                aria-label="Farbschema"
                                :model-value="themeMode"
                                @update:model-value="onThemeModeChange"
                            >
                                <ToggleGroupItem value="system" class="flex-1">
                                    System
                                </ToggleGroupItem>
                                <ToggleGroupItem value="light" class="flex-1">Hell</ToggleGroupItem>
                                <ToggleGroupItem value="dark" class="flex-1">
                                    Dunkel
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        <div class="flex items-center justify-between gap-4 px-2 py-3">
                            <div class="flex min-w-0 items-center gap-4">
                                <Type
                                    class="size-5 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Label for="settings-text-size" class="text-[15px] font-normal">
                                    Textgröße (Lieder)
                                </Label>
                            </div>
                            <Select v-model="songFontSize">
                                <SelectTrigger id="settings-text-size" class="w-36 shrink-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="small">Klein</SelectItem>
                                    <SelectItem value="medium">Normal</SelectItem>
                                    <SelectItem value="large">Groß</SelectItem>
                                    <SelectItem value="xlarge">Sehr groß</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div class="flex items-center justify-between gap-4 px-2 py-3">
                            <div class="flex min-w-0 items-center gap-4">
                                <Image
                                    class="size-5 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Label for="settings-melody-mode" class="text-[15px] font-normal">
                                    Notenansicht
                                </Label>
                            </div>
                            <Select v-model="melodyDisplayMode">
                                <SelectTrigger id="settings-melody-mode" class="w-36 shrink-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="image">Notenbild</SelectItem>
                                    <SelectItem value="xml">MusicXML</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div class="px-2 py-3">
                            <div class="flex items-center justify-between gap-4">
                                <div class="flex items-center gap-4">
                                    <Music
                                        class="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <p class="text-[15px]">Notengröße</p>
                                </div>
                                <span class="number-display text-lg leading-none">
                                    {{ Math.round(notationScale * 100) }}%
                                </span>
                            </div>
                            <div class="mt-4 flex items-center gap-3">
                                <span class="shrink-0 text-xs text-muted-foreground">50%</span>
                                <Slider
                                    v-model="notationScaleSlider"
                                    :min="0.5"
                                    :max="2"
                                    :step="0.1"
                                    aria-label="Notengröße"
                                    class="flex-1"
                                />
                                <span class="shrink-0 text-xs text-muted-foreground">200%</span>
                            </div>
                        </div>
                    </div>
                    <Separator />
                </section>

                <!-- Daten -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Daten</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-1 divide-y divide-border">
                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="navigateToDownload"
                        >
                            <CloudDownload
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0 flex-1">
                                <p class="text-[15px]">Heruntergeladene Inhalte</p>
                                <p class="text-sm text-muted-foreground">
                                    {{ songsCount }} Lieder, {{ filesCount }} Dateien
                                </p>
                            </div>
                            <ChevronRight
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                        </button>

                        <!-- Always visible: null renders „Vom Browser nicht unterstützt."
                             (matches the pre-migration behavior) -->
                        <div class="flex items-center gap-4 px-2 py-3">
                            <Server
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Dauerhafte Speicherung</p>
                                <p class="text-sm leading-relaxed text-muted-foreground">
                                    {{ persistedStatusText }}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="handleExport"
                        >
                            <Download
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Daten exportieren</p>
                                <p class="text-sm text-muted-foreground">
                                    Playlists und Favoriten als Datei sichern
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="importInput?.click()"
                        >
                            <CloudUpload
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Daten importieren</p>
                                <p class="text-sm text-muted-foreground">
                                    Aus einer Sicherungsdatei wiederherstellen
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="navigateToInstallPWA"
                        >
                            <Smartphone
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0 flex-1">
                                <p class="text-[15px]">App installieren</p>
                                <p class="text-sm text-muted-foreground">
                                    Installiere die App auf deinem Gerät
                                </p>
                            </div>
                            <ChevronRight
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                    <Separator />
                    <input
                        ref="importInput"
                        type="file"
                        accept="application/json,.json"
                        style="display: none"
                        @change="onImportFileChange"
                    />
                </section>

                <!-- Gefahrenbereich -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-destructive">Gefahrenbereich</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-4 px-2">
                        <p class="text-sm leading-relaxed text-muted-foreground">
                            Diese Aktionen können nicht rückgängig gemacht werden.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            class="mt-4 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            @click="handleDeleteAccount"
                        >
                            <Trash2 aria-hidden="true" />
                            Konto löschen
                        </Button>
                    </div>
                </section>

                <!-- Über die App -->
                <section>
                    <div class="flex items-center gap-3 px-2">
                        <h2 class="label-micro shrink-0 text-gold">Über die App</h2>
                        <Separator class="flex-1" />
                    </div>
                    <div class="mt-1 divide-y divide-border">
                        <div class="flex items-center gap-4 px-2 py-3">
                            <Info
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Version</p>
                                <p class="text-sm text-muted-foreground">{{ appVersion }}</p>
                            </div>
                        </div>

                        <a
                            :href="`mailto:${SUPPORT_EMAIL}`"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 transition-colors hover:bg-muted active:bg-muted"
                        >
                            <Mail
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div class="min-w-0">
                                <p class="text-[15px]">Kontakt &amp; Hilfe</p>
                                <p class="truncate text-sm text-muted-foreground">
                                    {{ SUPPORT_EMAIL }}
                                </p>
                            </div>
                        </a>

                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="openPrivacyPolicy"
                        >
                            <ShieldCheck
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p class="flex-1 text-[15px]">Datenschutz</p>
                            <ChevronRight
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                        </button>

                        <button
                            type="button"
                            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                            @click="router.push('/impressum')"
                        >
                            <FileText
                                class="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p class="flex-1 text-[15px]">Impressum</p>
                            <ChevronRight
                                class="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                    <Separator />
                </section>
            </div>
        </main>

        <!-- Name ändern -->
        <Dialog v-model:open="editNameOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Name ändern</DialogTitle>
                    <DialogDescription class="sr-only">
                        Ändern Sie Ihren Vor- und Nachnamen.
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-4">
                    <Input
                        v-model="editFirstName"
                        type="text"
                        placeholder="Vorname"
                        aria-label="Vorname"
                        autocomplete="given-name"
                    />
                    <Input
                        v-model="editLastName"
                        type="text"
                        placeholder="Nachname"
                        aria-label="Nachname"
                        autocomplete="family-name"
                    />
                </div>
                <DialogFooter>
                    <DialogClose as-child>
                        <Button type="button" variant="outline">Abbrechen</Button>
                    </DialogClose>
                    <Button type="button" @click="saveEditedName">Speichern</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';

import {
    ChevronRight,
    CloudDownload,
    CloudUpload,
    Contrast,
    Download,
    FileText,
    Image,
    Info,
    LogOut,
    Mail,
    Music,
    Server,
    ShieldCheck,
    Smartphone,
    SquarePen,
    Trash2,
    Type,
    User,
} from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useFavoritesStore } from '@/stores/favorites';
import { usePlaylistsStore } from '@/stores/playlists';
import { usePreferencesStore } from '@/stores/preferences';
import { useSongsStore } from '@/stores/songs';

import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';
import { useKeepAliveScroll } from '@/composables/useKeepAliveScroll';
import { useTheme } from '@/composables/useTheme';

import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { SUPPORT_EMAIL } from '@/config/support';
import { type Favorite, type Playlist, db } from '@/db';
import { downloadJsonFile, isPersisted } from '@/services/storage';

const router = useRouter();
const { user, logout, deleteAccount, isLoggedIn } = useAuth();
const { theme, setTheme } = useTheme();

// KeepAlive resets scrollTop on re-attach; save/restore it (Ionic parity)
const scrollRef = ref<HTMLElement | null>(null);
useKeepAliveScroll(scrollRef);
const { confirm } = useConfirm();
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
const songFontSize = computed<AcceptableValue>({
    get: () => preferencesStore.textSize,
    set: (value) => {
        if (value === 'small' || value === 'medium' || value === 'large' || value === 'xlarge') {
            preferencesStore.setTextSize(value);
        }
    },
});
const notationScale = computed(() => preferencesStore.notationScale);
// Reka's Slider works on number[] (multi-thumb capable) — bridge to the scalar store value.
const notationScaleSlider = computed<number[] | undefined>({
    get: () => [preferencesStore.notationScale],
    set: (value) => {
        const scale = value?.[0];
        if (typeof scale === 'number') {
            preferencesStore.setNotationScale(scale);
        }
    },
});
const melodyDisplayMode = computed<AcceptableValue>({
    get: () => preferencesStore.melodyDisplayMode,
    set: (value) => {
        if (value === 'image' || value === 'xml') {
            preferencesStore.setMelodyDisplayMode(value);
        }
    },
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
// (onActivated replaces Ionic's onIonViewWillEnter: the new tab shell keeps
// pages alive with <KeepAlive> instead of an ion-router-outlet.)
onActivated(async () => {
    await updateFilesCount();
    persistentStorage.value = await isPersisted();
});

async function loadSettings() {
    // Mirror the persisted preference into the segment (useTheme already
    // applied it on app startup)
    themeMode.value = theme.value;
}

async function updateFilesCount() {
    filesCount.value = await songsStore.getStoredFilesCount();
}

function onThemeModeChange(value: AcceptableValue | AcceptableValue[]) {
    if (value === 'system' || value === 'light' || value === 'dark') {
        themeMode.value = value;
        onThemeChange();
    }
}

function onThemeChange() {
    // useTheme owns persistence ('settings.theme') and applies the `dark` class.
    setTheme(themeMode.value);
}

function navigateToDownload() {
    router.push('/download');
}

function navigateToInstallPWA() {
    router.push('/install-pwa');
}

// Name ändern dialog
const editNameOpen = ref(false);
const editFirstName = ref('');
const editLastName = ref('');

function openEditNameModal() {
    editFirstName.value = user.value?.firstName || '';
    editLastName.value = user.value?.lastName || '';
    editNameOpen.value = true;
}

async function saveEditedName() {
    editNameOpen.value = false;
    await updateUserName(editFirstName.value, editLastName.value);
}

async function updateUserName(_firstName: string, _lastName: string) {
    try {
        // TODO: Implement API call to update user name on server
        // For now, show a toast that the feature is coming
        toast.warning('Name-Änderung wird in einer zukünftigen Version verfügbar sein.', {
            duration: 3000,
        });
    } catch (error) {
        console.error('Error updating name:', error);
    }
}

function showToast(message: string, color: 'success' | 'danger') {
    if (color === 'success') {
        toast.success(message, { duration: 3000 });
    } else {
        toast.error(message, { duration: 3000 });
    }
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
        showToast('Daten wurden exportiert.', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Die Daten konnten nicht exportiert werden.', 'danger');
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

        showToast(
            `${playlists.length} Playlists und ${favorites.length} Favoriten importiert.`,
            'success',
        );
    } catch (error) {
        console.error('Error importing data:', error);
        showToast(
            'Die Datei konnte nicht importiert werden. Bitte wählen Sie eine gültige Sicherungsdatei.',
            'danger',
        );
    }
}

async function handleLogout() {
    const proceed = await confirm({
        title: 'Abmelden',
        message:
            'Möchten Sie sich wirklich abmelden? Ihre Playlists, Favoriten und Einstellungen werden dabei von diesem Gerät gelöscht.',
        confirmText: 'Abmelden',
    });
    if (!proceed) return;

    await logout();
    router.push('/login');
}

async function handleDeleteAccount() {
    const proceed = await confirm({
        title: 'Konto löschen',
        message:
            'Sind Sie sicher, dass Sie Ihr Konto unwiderruflich löschen möchten? Alle Ihre Daten werden gelöscht.',
        confirmText: 'Konto löschen',
        destructive: true,
    });
    if (!proceed) return;

    const result = await deleteAccount();
    if (result.success) {
        // deleteAccount already wiped this device and is
        // hard-redirecting to /login — nothing left to do here.
        return;
    }

    if (result.code === 'FORBIDDEN') {
        // Automatic deletion is not enabled on the server (yet):
        // offer the honest route via the support address instead.
        const writeEmail = await confirm({
            title: 'Kontolöschung nicht möglich',
            message: result.error,
            confirmText: 'E-Mail schreiben',
            cancelText: 'Schließen',
        });
        if (writeEmail) {
            window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Kontolöschung')}`;
        }
    } else {
        showToast(result.error, 'danger');
    }
}

function openPrivacyPolicy() {
    router.push('/datenschutz');
}
</script>
