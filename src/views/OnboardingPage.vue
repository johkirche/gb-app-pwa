<template>
    <div class="flex h-full flex-col bg-background">
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
            >
                <!-- Step Indicator Dots -->
                <StepIndicator
                    :current-step="currentStep"
                    :total-steps="totalSteps"
                    @back="prevStep"
                />

                <!-- Step 1: Install PWA -->
                <InstallPWAStep v-if="currentStep === 1" @next="nextStep" @skip="skipOnboarding" />

                <!-- Step 2: Download Content -->
                <DownloadContentStep
                    v-if="currentStep === 2"
                    :is-syncing="isSyncing"
                    :download-started="downloadStarted"
                    :sync-error="syncError"
                    :sync-progress="syncProgress"
                    :download-complete="downloadComplete"
                    :failed-count="failedFiles.length"
                    :storage-estimate="storage"
                    @download="handleDownload"
                    @retry="handleRetry"
                    @finish="finishOnboarding"
                    @skip="skipOnboarding"
                />
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';

import DownloadContentStep from '@/components/onboarding/DownloadContentStep.vue';
import InstallPWAStep from '@/components/onboarding/InstallPWAStep.vue';
import StepIndicator from '@/components/utils/StepIndicator.vue';

import { type StorageSpace, getStorageEstimate } from '@/services/storage';

const router = useRouter();
const songsStore = useSongsStore();
const { isSyncing, error: syncError, syncProgress, failedFiles } = storeToRefs(songsStore);

const ONBOARDING_IN_PROGRESS_KEY = 'onboarding.inProgress';
const ONBOARDING_STEP_KEY = 'onboarding.currentStep';

// Step management
const currentStep = ref(1);
const totalSteps = 2;

// Download state
const downloadStarted = ref(false);
const downloadComplete = ref(false);
const storage = ref<StorageSpace | null>(null);

function nextStep() {
    if (currentStep.value < totalSteps) {
        currentStep.value++;
    }
}

function prevStep() {
    if (currentStep.value > 1) {
        currentStep.value--;
    }
}

async function handleDownload() {
    // A second press while one is running would launch a sync alongside it.
    if (songsStore.isSyncing) {
        return;
    }
    downloadStarted.value = true;
    try {
        downloadComplete.value = false;
        await songsStore.syncAll();
        // Only a sync without failed files counts as complete
        downloadComplete.value = songsStore.failedFiles.length === 0;
    } catch (err) {
        console.error('Download failed:', err);
    } finally {
        storage.value = await getStorageEstimate();
    }
}

// The download waits to be asked for: the reader may be on mobile data and
// rather wait for WLAN, so the step quotes the transfer and leaves the moment to
// them. An already fully synced library has nothing to ask about and goes
// straight to the finished state.
function markCompleteIfSynced() {
    if (songsStore.isSyncing) {
        return;
    }
    if (songsStore.hasSongs && songsStore.failedFiles.length === 0) {
        downloadComplete.value = true;
    }
}

async function handleRetry() {
    try {
        await songsStore.retryFailedFiles();
        downloadComplete.value = songsStore.failedFiles.length === 0;
    } catch (err) {
        console.error('Retry failed:', err);
    } finally {
        storage.value = await getStorageEstimate();
    }
}

function finishOnboarding() {
    localStorage.removeItem(ONBOARDING_IN_PROGRESS_KEY);
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    router.push('/tabs/lieder');
}

function skipOnboarding() {
    localStorage.removeItem(ONBOARDING_IN_PROGRESS_KEY);
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    router.push('/tabs/lieder');
}

onMounted(async () => {
    localStorage.setItem(ONBOARDING_IN_PROGRESS_KEY, '1');

    const storedStep = Number(localStorage.getItem(ONBOARDING_STEP_KEY));
    if (!Number.isNaN(storedStep) && storedStep >= 1 && storedStep <= totalSteps) {
        currentStep.value = storedStep;
    }

    storage.value = await getStorageEstimate();
});

watch(
    currentStep,
    (step) => {
        localStorage.setItem(ONBOARDING_STEP_KEY, String(step));
        if (step === 2) {
            markCompleteIfSynced();
        }
    },
    { immediate: true },
);
</script>
