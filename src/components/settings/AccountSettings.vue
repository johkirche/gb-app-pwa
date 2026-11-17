<template>
    <!-- The one section of the settings that is entirely about the account, so
         the one that has to say plainly when there is none. Everything else in
         the app keeps working; this is where signing back in lives. -->
    <LoginRequiredNotice v-if="!isLoggedIn" title="Nicht angemeldet" class="mb-6">
        Sie lesen Ihr heruntergeladenes Gesangbuch ohne Anmeldung. Ihre Playlists, Favoriten und
        Einstellungen bleiben auf diesem Gerät erhalten.{{ waitingLabel }} Für Kontoeinstellungen
        und zum Synchronisieren melden Sie sich bitte erneut an, sobald Sie online sind.
    </LoginRequiredNotice>

    <SettingsList>
        <div class="flex items-center gap-4 px-2 py-3">
            <User class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[0.9375rem]">E-Mail</p>
                <p class="truncate text-sm text-muted-foreground">
                    {{ user?.email || 'Nicht angemeldet' }}
                </p>
            </div>
        </div>

        <button
            v-if="isLoggedIn"
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="openEditNameModal"
        >
            <SquarePen class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[0.9375rem]">Name</p>
                <p class="truncate text-sm text-muted-foreground">
                    {{ fullName ?? 'Nicht angegeben' }}
                </p>
            </div>
        </button>

        <!-- The row's icon is the symbol itself: a 1.25rem roundel is too
             small to read, so it stands a size up, where it can be told apart. -->
        <button
            v-if="isLoggedIn"
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="openSymbolDialog"
        >
            <UserAvatar
                :src="avatarUrl"
                :initials="initials"
                class="-mx-1.5 size-8 text-[0.8125rem]"
            />
            <div class="min-w-0">
                <p class="text-[0.9375rem]">Symbol</p>
                <p class="truncate text-sm text-muted-foreground">
                    {{ user?.avatar ? 'Aus dem Gesangbuch' : 'Nicht gewählt' }}
                </p>
            </div>
        </button>

        <button
            v-if="isLoggedIn"
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="openGemeindeDialog"
        >
            <Church class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[0.9375rem]">Gemeinde</p>
                <p class="truncate text-sm text-muted-foreground">
                    {{ gemeinde?.name ?? 'Nicht angegeben' }}
                </p>
            </div>
        </button>

        <!-- An account made by code has no password, and a forgotten one is
             replaced here: sign in by code, then set a new one. -->
        <button
            v-if="isLoggedIn"
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="openPasswordDialog"
        >
            <KeyRound class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div class="min-w-0">
                <p class="text-[0.9375rem]">Passwort</p>
                <p class="text-sm text-muted-foreground">
                    Festlegen oder ändern. Anmelden geht auch ohne, mit einem Code per E-Mail.
                </p>
            </div>
        </button>

        <!-- Tapping it syncs at once; otherwise it runs by itself after every
             change and whenever the app comes back to the foreground. -->
        <button
            v-if="isLoggedIn"
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            :aria-busy="userDataSync.status === 'syncing'"
            @click="syncUserData()"
        >
            <RefreshCw
                class="size-5 shrink-0 text-muted-foreground"
                :class="{ 'animate-spin': userDataSync.status === 'syncing' }"
                aria-hidden="true"
            />
            <div class="min-w-0">
                <p class="text-[0.9375rem]">Playlists und Markierungen</p>
                <p class="text-sm text-muted-foreground">{{ syncLabel }}</p>
            </div>
        </button>

        <button
            v-if="isLoggedIn"
            type="button"
            class="flex w-full items-center gap-4 rounded-sm px-2 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            @click="handleLogout"
        >
            <LogOut class="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <p class="text-[0.9375rem] text-destructive">Abmelden</p>
        </button>
    </SettingsList>

    <!-- The devices the account is signed in on, at most four. Signing one out
         ends its session: it keeps its songs and asks for a code the next time
         it reaches the server. This one is not offered; that is „Abmelden“. -->
    <section v-if="isLoggedIn" class="mb-8">
        <div class="flex items-center gap-3 px-2">
            <h2 class="label-micro shrink-0 text-muted-foreground">Geräte</h2>
            <Separator class="flex-1" />
        </div>
        <p class="mt-3 px-2 text-sm leading-relaxed text-muted-foreground">
            Ihr Konto gilt für bis zu {{ devices?.limit ?? 4 }} Geräte gleichzeitig.
        </p>
        <p v-if="devicesError" class="mt-3 px-2 text-sm leading-relaxed text-muted-foreground">
            {{ devicesError }}
        </p>
        <div v-else-if="!devices" class="mt-4 flex items-center gap-2 px-2 text-sm">
            <Spinner size="sm" />
            <span class="text-muted-foreground">Wird geladen …</span>
        </div>
        <ul v-else class="mt-2">
            <li
                v-for="device in devices.devices"
                :key="device.id"
                class="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-3"
            >
                <component
                    :is="deviceIcon(device.name)"
                    class="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
                <div class="min-w-0 flex-1">
                    <p class="break-words text-[0.9375rem]">{{ device.name }}</p>
                    <p class="text-sm text-muted-foreground">
                        {{
                            device.current
                                ? 'Dieses Gerät'
                                : `zuletzt ${lastSeen(device.last_seen)}`
                        }}
                    </p>
                </div>
                <Button
                    v-if="!device.current"
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:text-destructive"
                    :disabled="signingOut !== null"
                    @click="handleSignOutDevice(device)"
                >
                    <LoaderCircle
                        v-if="signingOut === device.id"
                        class="animate-spin"
                        aria-hidden="true"
                    />
                    Abmelden
                </Button>
            </li>
        </ul>
    </section>

    <!-- Gefahrenbereich: still its own heading, because it is the one place in
         the settings where a tap cannot be taken back. Hidden without a session:
         deleting an account needs the server, and offering a button that can
         only answer "Sie sind nicht angemeldet" is worse than not offering it. -->
    <section v-if="isLoggedIn">
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
                :disabled="deleting"
                :aria-busy="deleting"
                @click="handleDeleteAccount"
            >
                <LoaderCircle v-if="deleting" class="animate-spin" aria-hidden="true" />
                <Trash2 v-else aria-hidden="true" />
                {{ deleting ? 'Wird gelöscht…' : 'Konto löschen' }}
            </Button>
        </div>
    </section>

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
                <Button type="button" :disabled="saving" @click="saveEditedName">Speichern</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- Symbol wählen -->
    <Dialog v-model:open="symbolOpen">
        <DialogContent class="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Symbol</DialogTitle>
                <DialogDescription>
                    Die Symbole stammen aus dem gedruckten Gesangbuch. Das gewählte steht in der App
                    neben Ihrem Namen.
                </DialogDescription>
            </DialogHeader>
            <SymbolPicker
                v-if="symbolOpen"
                v-model="editAvatar"
                :initials="initials"
                surface="popover"
            />
            <DialogFooter>
                <DialogClose as-child>
                    <Button type="button" variant="outline">Abbrechen</Button>
                </DialogClose>
                <Button type="button" :disabled="saving" @click="saveSymbol">Speichern</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- Passwort festlegen -->
    <Dialog v-model:open="passwordOpen">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Passwort festlegen</DialogTitle>
                <DialogDescription>
                    Mindestens 8 Zeichen, ein Großbuchstabe und eine Zahl oder ein Sonderzeichen.
                    Ein bisheriges Passwort gilt danach nicht mehr.
                </DialogDescription>
            </DialogHeader>
            <form id="password-form" class="space-y-4" novalidate @submit.prevent="savePassword">
                <!-- For a password manager, which files the password under the address. -->
                <input
                    type="email"
                    name="email"
                    autocomplete="username"
                    :value="user?.email ?? ''"
                    class="sr-only"
                    tabindex="-1"
                    aria-hidden="true"
                    readonly
                />
                <Input
                    v-model="newPassword"
                    type="password"
                    placeholder="Neues Passwort"
                    aria-label="Neues Passwort"
                    autocomplete="new-password"
                />
                <Input
                    v-model="repeatPassword"
                    type="password"
                    placeholder="Passwort wiederholen"
                    aria-label="Passwort wiederholen"
                    autocomplete="new-password"
                />
                <p v-if="passwordHint" class="text-sm text-muted-foreground">{{ passwordHint }}</p>
            </form>
            <DialogFooter>
                <DialogClose as-child>
                    <Button type="button" variant="outline">Abbrechen</Button>
                </DialogClose>
                <Button
                    type="submit"
                    form="password-form"
                    :disabled="savingPassword || !isPasswordValid"
                >
                    Speichern
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <!-- Gemeinde wählen -->
    <Dialog v-model:open="gemeindeOpen">
        <!-- Flex, because a sticky grid item cannot leave its own row; and without
             padding above and below, or the rows would show through it around the
             map and the buttons, which stay while the rows go by. -->
        <DialogContent class="flex max-h-[90dvh] flex-col overflow-y-auto py-0">
            <DialogHeader class="pt-6">
                <DialogTitle>Gemeinde</DialogTitle>
                <DialogDescription>
                    Damit kann die App Ihnen später die Lieder Ihrer Gottesdienste zeigen. Die
                    Angabe ist freiwillig.
                </DialogDescription>
            </DialogHeader>
            <GemeindePicker v-if="gemeindeOpen" v-model="editGemeinde" surface="bg-popover" />
            <DialogFooter class="sticky bottom-0 z-10 bg-popover pb-6 pt-2">
                <DialogClose as-child>
                    <Button type="button" variant="outline">Abbrechen</Button>
                </DialogClose>
                <Button type="button" :disabled="saving" @click="saveGemeinde">Speichern</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import {
    Church,
    KeyRound,
    LoaderCircle,
    LogOut,
    Monitor,
    RefreshCw,
    Smartphone,
    SquarePen,
    Tablet,
    Trash2,
    User,
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';
import { usePasswordRules } from '@/composables/usePasswordRules';
import { useProfile } from '@/composables/useProfile';

import GemeindePicker from '@/components/profile/GemeindePicker.vue';
import SymbolPicker from '@/components/profile/SymbolPicker.vue';
import UserAvatar from '@/components/profile/UserAvatar.vue';
import SettingsList from '@/components/settings/SettingsList.vue';
import LoginRequiredNotice from '@/components/shell/LoginRequiredNotice.vue';
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
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

import { type Device, listDevices, setPassword, signOutDevice } from '@/api/einstieg.api';
import { SUPPORT_EMAIL } from '@/config/support';
import { countPending, syncUserData, userDataSync } from '@/services/userData/sync';
import type { GemeindeRef } from '@/utils/gemeinden';

const router = useRouter();
const { user, logout, deleteAccount, isLoggedIn } = useAuth();
const { confirm } = useConfirm();

const { fullName, initials, avatarUrl, gemeinde, saveProfile } = useProfile();

function changes(n: number): string {
    return n === 1 ? 'Eine Änderung' : `${n} Änderungen`;
}

/** Where the reader's lists stand with the account, in one line. */
const syncLabel = computed(() => {
    const { status, pending, lastSyncedAt } = userDataSync;
    if (status === 'syncing') return 'Wird gesichert …';
    if (pending > 0 && status === 'offline')
        return `${changes(pending)} warten auf eine Verbindung`;
    if (pending > 0) return `${changes(pending)} noch nicht gesichert`;
    if (status === 'error') return 'Zuletzt fehlgeschlagen, wird wieder versucht';
    if (lastSyncedAt) return 'Alles in Ihrem Konto gesichert';
    return 'Noch nicht abgeglichen';
});

/** Said without a session: what waits on this device for the next login. */
const waitingLabel = computed(() =>
    userDataSync.pending > 0
        ? ` ${changes(userDataSync.pending)} ${userDataSync.pending === 1 ? 'wird' : 'werden'} nach der Anmeldung in Ihrem Konto gesichert.`
        : '',
);

// ---- Geräte ----

const devices = ref<{ limit: number; devices: Device[] } | null>(null);
const devicesError = ref<string | null>(null);
const signingOut = ref<number | null>(null);

async function loadDevices() {
    devicesError.value = null;
    try {
        devices.value = await listDevices();
    } catch {
        devices.value = null;
        devicesError.value = navigator.onLine
            ? 'Die Geräte konnten nicht geladen werden.'
            : 'Die Liste der Geräte braucht eine Internetverbindung.';
    }
}

onMounted(() => {
    if (isLoggedIn.value) void loadDevices();
});
watch(isLoggedIn, (loggedIn) => {
    if (loggedIn) void loadDevices();
});

async function handleSignOutDevice(device: Device) {
    const proceed = await confirm({
        title: 'Gerät abmelden',
        message: `${device.name} wird abgemeldet. Es behält seine Lieder und fragt beim nächsten Öffnen nach einem Code.`,
        confirmText: 'Abmelden',
        destructive: true,
    });
    if (!proceed) return;
    signingOut.value = device.id;
    try {
        await signOutDevice(device.id);
        await loadDevices();
    } catch {
        toast.error('Das hat nicht geklappt. Bitte versuchen Sie es später noch einmal.', {
            duration: 4000,
        });
    } finally {
        signingOut.value = null;
    }
}

function deviceIcon(name: string) {
    if (/iPad|Tablet/.test(name)) return Tablet;
    if (/iPhone|Handy/.test(name)) return Smartphone;
    return Monitor;
}

function lastSeen(iso: string): string {
    const then = new Date(iso);
    const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
    if (days <= 0) return 'heute';
    if (days === 1) return 'gestern';
    if (days < 14) return `vor ${days} Tagen`;
    if (days < 60) return `vor ${Math.floor(days / 7)} Wochen`;
    return `am ${then.toLocaleDateString('de-DE')}`;
}

// ---- Passwort ----

const passwordOpen = ref(false);
const newPassword = ref('');
const repeatPassword = ref('');
const savingPassword = ref(false);
const { hasMinLength, hasUppercase, hasNumberOrSpecial, passwordsMatch, isPasswordValid } =
    usePasswordRules(newPassword, repeatPassword);

const passwordHint = computed(() => {
    if (!newPassword.value) return null;
    const missing = [
        !hasMinLength.value && 'mindestens 8 Zeichen',
        !hasUppercase.value && 'ein Großbuchstabe',
        !hasNumberOrSpecial.value && 'eine Zahl oder ein Sonderzeichen',
    ].filter(Boolean);
    if (missing.length) return `Es fehlt noch: ${missing.join(', ')}.`;
    if (repeatPassword.value && !passwordsMatch.value)
        return 'Die beiden Eingaben stimmen nicht überein.';
    return null;
});

function openPasswordDialog() {
    newPassword.value = '';
    repeatPassword.value = '';
    passwordOpen.value = true;
}

async function savePassword() {
    if (savingPassword.value || !isPasswordValid.value) return;
    savingPassword.value = true;
    try {
        await setPassword(newPassword.value);
        passwordOpen.value = false;
        toast.success('Das Passwort ist gespeichert.', { duration: 3000 });
    } catch {
        toast.error(
            'Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es später noch einmal.',
            {
                duration: 4000,
            },
        );
    } finally {
        savingPassword.value = false;
    }
}

// One write at a time: a second „Speichern" on a slow line would race the first.
const saving = ref(false);

/** Save, and say so when it did not reach the account. Closes the dialog only on success. */
async function save(patch: Parameters<typeof saveProfile>[0], close: () => void) {
    if (saving.value) return;
    saving.value = true;
    try {
        if (await saveProfile(patch)) {
            close();
        } else {
            toast.error('Das hat nicht geklappt. Bitte versuchen Sie es später noch einmal.', {
                duration: 4000,
            });
        }
    } finally {
        saving.value = false;
    }
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

function saveEditedName() {
    void save({ firstName: editFirstName.value, lastName: editLastName.value }, () => {
        editNameOpen.value = false;
    });
}

// Symbol dialog
const symbolOpen = ref(false);
const editAvatar = ref<string | null>(null);

function openSymbolDialog() {
    editAvatar.value = user.value?.avatar ?? null;
    symbolOpen.value = true;
}

function saveSymbol() {
    void save({ avatar: editAvatar.value }, () => {
        symbolOpen.value = false;
    });
}

// Gemeinde dialog
const gemeindeOpen = ref(false);
const editGemeinde = ref<GemeindeRef | null>(null);

function openGemeindeDialog() {
    editGemeinde.value = gemeinde.value;
    gemeindeOpen.value = true;
}

function saveGemeinde() {
    void save({ gemeinde: editGemeinde.value }, () => {
        gemeindeOpen.value = false;
    });
}

async function handleLogout() {
    // One last upload, so what was just changed goes with the account rather
    // than with the device.
    await syncUserData();
    const pending = await countPending();
    const proceed = await confirm({
        title: 'Abmelden',
        message:
            pending > 0
                ? `${pending === 1 ? 'Eine Änderung ist' : `${pending} Änderungen sind`} noch nicht in Ihrem Konto gesichert, weil der Server gerade nicht erreichbar ist. Wenn Sie sich jetzt abmelden, ${pending === 1 ? 'geht sie' : 'gehen sie'} verloren.`
                : 'Ihre Playlists, Favoriten, Markierungen und Einstellungen sind in Ihrem Konto gesichert und nach der nächsten Anmeldung wieder da. Von diesem Gerät werden sie beim Abmelden entfernt.',
        confirmText: 'Abmelden',
        destructive: pending > 0,
    });
    if (!proceed) return;

    await logout();
    router.push('/anmelden');
}

// True while the server is deleting: the button spins and is disabled, so a
// slow connection neither looks frozen nor invites a second request.
const deleting = ref(false);

async function handleDeleteAccount() {
    if (deleting.value) return;

    const proceed = await confirm({
        title: 'Konto löschen',
        message:
            'Sind Sie sicher, dass Sie Ihr Konto unwiderruflich löschen möchten? Alle Ihre Daten werden gelöscht.',
        confirmText: 'Konto löschen',
        destructive: true,
    });
    if (!proceed) return;

    deleting.value = true;
    const result = await deleteAccount();
    if (result.success) {
        // deleteAccount already wiped this device and is
        // hard-redirecting to /anmelden — nothing left to do here.
        // Leave the spinner running until the page goes.
        return;
    }
    deleting.value = false;

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
        toast.error(result.error, { duration: 3000 });
    }
}
</script>
