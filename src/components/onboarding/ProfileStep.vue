<template>
    <div class="flex flex-1 flex-col animate-in duration-300 fade-in slide-in-from-bottom-2">
        <!-- The step's picture is the reader's own: it fills in as they type
             and choose, so what they are making is in front of them. -->
        <UserAvatar
            :src="previewSrc"
            :initials="previewInitials"
            class="mx-auto mb-6 size-32 text-[3rem] shadow-sm"
        />

        <h1 class="text-center font-display text-3xl font-semibold">Wie dürfen wir Sie nennen?</h1>
        <p class="mt-3 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
            Name und Symbol sind freiwillig. Sie können beides später in den Einstellungen ändern.
        </p>

        <form id="onboarding-profile" class="mt-8 space-y-5" @submit.prevent="next">
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

        <DownloadStatus
            class="mt-8"
            v-bind="download"
            @download="$emit('download')"
            @retry="$emit('retry')"
        />

        <div class="mt-auto flex flex-col gap-2 pt-8">
            <!-- On while the book comes down: the tour after this step is
                 there to fill the rest of the wait, and holds „Fertig". -->
            <Button
                type="submit"
                form="onboarding-profile"
                size="lg"
                class="w-full"
                :disabled="saving"
                :aria-busy="saving"
            >
                <Spinner v-if="saving" size="sm" class="text-primary-foreground" />
                <template v-else>
                    Weiter
                    <ArrowRight aria-hidden="true" />
                </template>
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { ArrowRight } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

import { useUserStore } from '@/stores/user';

import { initialsOf, useProfile } from '@/composables/useProfile';
import { useSymbols } from '@/composables/useSymbols';

import DownloadStatus from '@/components/onboarding/DownloadStatus.vue';
import type { DownloadState } from '@/components/onboarding/downloadState';
import SymbolPicker from '@/components/profile/SymbolPicker.vue';
import UserAvatar from '@/components/profile/UserAvatar.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

defineProps<{
    download: DownloadState;
    /** The reader put the book off for WLAN: the symbols wait to be asked for too. */
    askFirst: boolean;
}>();

const emit = defineEmits<{
    download: [];
    retry: [];
    next: [];
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

async function next() {
    if (saving.value) return;
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
    emit('next');
}
</script>
