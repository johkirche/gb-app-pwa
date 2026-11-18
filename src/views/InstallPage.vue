<template>
    <!-- The install step of the way in, between the start page and the sign-in.
         Where installing is worth it (an iPhone above all, whose home-screen app
         keeps storage of its own), this comes before the account, so that the
         sign-in and the download happen where the reading will. -->
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="Installieren">
            <template #leading>
                <BackButton default-href="/willkommen" />
            </template>
        </AppPageHeader>
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8"
            >
                <InstallPWAStep mode="einstieg" @next="router.push('/anmelden')" />
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

import InstallPWAStep from '@/components/onboarding/InstallPWAStep.vue';
import AppPageHeader from '@/components/shell/AppPageHeader.vue';
import BackButton from '@/components/shell/BackButton.vue';

const router = useRouter();
</script>
