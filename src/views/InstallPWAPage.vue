<template>
    <div class="flex h-full flex-col bg-background">
        <AppPageHeader title="App installieren">
            <template #leading>
                <BackButton default-href="/tabs/einstellungen" />
            </template>
        </AppPageHeader>
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8"
            >
                <InstallPWAStep mode="standalone" @done="handleDone" />
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

function handleDone() {
    router.back();
}
</script>
