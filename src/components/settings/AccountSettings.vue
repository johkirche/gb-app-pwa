<template>
    <!-- The one section of the settings that is entirely about the account, so
         the one that has to say plainly when there is none. Everything else in
         the app keeps working; this is where signing back in lives. -->
    <LoginRequiredNotice v-if="!isLoggedIn" title="Nicht angemeldet" class="mb-6">
        Sie lesen Ihr heruntergeladenes Gesangbuch ohne Anmeldung. Ihre Playlists, Favoriten und
        Einstellungen bleiben auf diesem Gerät erhalten. Für Kontoeinstellungen und zum
        Synchronisieren melden Sie sich bitte erneut an, sobald Sie online sind.
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
import { ref } from 'vue';

import { Church, LoaderCircle, LogOut, SquarePen, Trash2, User } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';
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

import { SUPPORT_EMAIL } from '@/config/support';
import type { GemeindeRef } from '@/utils/gemeinden';

const router = useRouter();
const { user, logout, deleteAccount, isLoggedIn } = useAuth();
const { confirm } = useConfirm();

const { fullName, initials, avatarUrl, gemeinde, saveProfile } = useProfile();

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
        // hard-redirecting to /login — nothing left to do here.
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
