<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <!-- The step's picture is the reader's own: it fills in as they type
             and choose, so what they are making is in front of them. -->
        <UserAvatar
            :src="previewSrc"
            :initials="previewInitials"
            class="mx-auto mb-6 size-24 text-[2.25rem] shadow-sm transition-transform duration-300"
        />

        <h1 class="text-center font-display text-3xl font-semibold">Wie dürfen wir Sie nennen?</h1>
        <p class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
            Name und Symbol sind freiwillig. Sie können beides später in den Einstellungen ändern.
        </p>

        <form id="onboarding-profile" class="mt-8 space-y-5" @submit.prevent="finish">
            <div class="space-y-2">
                <Label for="onboarding-first-name">Vorname</Label>
                <Input
                    id="onboarding-first-name"
                    v-model="firstName"
                    type="text"
                    autocomplete="given-name"
                    :disabled="saving"
                />
            </div>
            <div class="space-y-2">
                <Label for="onboarding-last-name">Nachname</Label>
                <Input
                    id="onboarding-last-name"
                    v-model="lastName"
                    type="text"
                    autocomplete="family-name"
                    :disabled="saving"
                />
            </div>
        </form>

        <section class="mt-10" aria-labelledby="onboarding-symbol-heading">
            <h2 id="onboarding-symbol-heading" class="text-[0.9375rem] font-medium">Ihr Symbol</h2>
            <p class="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
                Die Symbole stammen aus dem gedruckten Gesangbuch. Das gewählte steht in der App
                neben Ihrem Namen.
            </p>
            <SymbolPicker v-model="avatar" :initials="previewInitials" :ask-first="askFirst" />
        </section>

        <!-- The download carries on behind this step; what it is doing stays
             in sight, worded as the download step words it. -->
        <div class="mt-8 rounded-lg bg-muted p-4">
            <template v-if="isSyncing">
                <p class="text-sm text-muted-foreground">
                    <template v-if="syncProgress.phase === 'files' && syncProgress.total > 0">
                        Das Gesangbuch wird geladen ·
                        <span class="tabular-nums">
                            {{ syncProgress.current }} von {{ syncProgress.total }} Dateien
                        </span>
                    </template>
                    <template v-else>Das Gesangbuch wird geladen...</template>
                </p>
                <Progress
                    v-if="syncProgress.phase === 'files' && syncProgress.total > 0"
                    :model-value="syncProgress.current / syncProgress.total"
                    class="mt-3"
                />
            </template>
            <p v-else-if="downloadComplete" class="flex items-center gap-3 text-sm">
                <CircleCheck class="size-5 shrink-0 text-primary" aria-hidden="true" />
                Das Gesangbuch ist geladen.
            </p>
            <div v-else-if="failed" class="flex flex-col items-start gap-2">
                <p class="text-sm leading-relaxed text-destructive">
                    <template v-if="failedCount > 0">
                        {{ failedCount }} Dateien konnten nicht heruntergeladen werden.
                    </template>
                    <template v-else>{{ syncError }}</template>
                </p>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    @click="failedCount > 0 ? $emit('retry') : $emit('download')"
                >
                    Erneut versuchen
                </Button>
            </div>
            <div v-else class="flex flex-col items-start gap-2">
                <p class="text-sm leading-relaxed text-muted-foreground">
                    Das Gesangbuch ist noch nicht heruntergeladen. Das geht jetzt oder später über
                    die Liederliste.
                </p>
                <Button type="button" variant="ghost" size="sm" @click="$emit('download')">
                    <Download aria-hidden="true" />
                    Jetzt laden
                </Button>
            </div>
        </div>

        <div class="mt-auto flex flex-col gap-2 pt-8">
            <!-- Held while the book is still coming down, as „Fertig" always
                 was: a Liederliste with half its engravings is no place to be
                 sent. -->
            <Button
                type="submit"
                form="onboarding-profile"
                size="lg"
                class="w-full"
                :disabled="isSyncing || saving"
                :aria-busy="saving"
            >
                <Spinner v-if="saving" size="sm" class="text-primary-foreground" />
                <template v-else>
                    Fertig
                    <Check aria-hidden="true" />
                </template>
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Check, CircleCheck, Download } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

import { useUserStore } from '@/stores/user';

import { initialsOf, useProfile } from '@/composables/useProfile';
import { useSymbols } from '@/composables/useSymbols';

import SymbolPicker from '@/components/profile/SymbolPicker.vue';
import UserAvatar from '@/components/profile/UserAvatar.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

const props = defineProps<{
    isSyncing: boolean;
    downloadStarted: boolean;
    downloadComplete: boolean;
    failedCount: number;
    syncError: string | null;
    syncProgress: { phase: string; current: number; total: number };
    /** The reader put the book off for WLAN: the symbols wait to be asked for too. */
    askFirst: boolean;
}>();

const emit = defineEmits<{
    download: [];
    retry: [];
    finish: [];
}>();

const userStore = useUserStore();
const { avatarUrl, saveProfile } = useProfile();
const { images } = useSymbols();

// A reader who comes through here twice (a new device) starts from what the
// account already says.
const firstName = ref(userStore.user?.firstName ?? '');
const lastName = ref(userStore.user?.lastName ?? '');
const avatar = ref<string | null>(userStore.user?.avatar ?? null);
const saving = ref(false);

const previewInitials = computed(() => initialsOf(firstName.value, lastName.value));
const previewSrc = computed(() => {
    if (!avatar.value) return null;
    return (
        images[avatar.value] ?? (avatar.value === userStore.user?.avatar ? avatarUrl.value : null)
    );
});

const failed = computed(
    () =>
        props.downloadStarted &&
        !props.isSyncing &&
        !props.downloadComplete &&
        (!!props.syncError || props.failedCount > 0),
);

async function finish() {
    if (props.isSyncing || saving.value) return;
    saving.value = true;
    try {
        const saved = await saveProfile({
            firstName: firstName.value,
            lastName: lastName.value,
            avatar: avatar.value,
        });
        if (!saved) {
            toast.warning(
                'Name und Symbol konnten nicht gespeichert werden. Sie können sie später in den Einstellungen festlegen.',
                { duration: 5000 },
            );
        }
    } finally {
        saving.value = false;
    }
    emit('finish');
}
</script>
