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
                <p class="text-[15px]">E-Mail</p>
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
                @click="handleDeleteAccount"
            >
                <Trash2 aria-hidden="true" />
                Konto löschen
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
                <Button type="button" @click="saveEditedName">Speichern</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { LogOut, SquarePen, Trash2, User } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';

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

const router = useRouter();
const { user, logout, deleteAccount, isLoggedIn } = useAuth();
const { confirm } = useConfirm();

const displayName = computed(() => {
    if (user.value?.firstName || user.value?.lastName) {
        return [user.value.firstName, user.value.lastName].filter(Boolean).join(' ');
    }
    return 'Nicht angegeben';
});

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
        toast.error(result.error, { duration: 3000 });
    }
}
</script>
