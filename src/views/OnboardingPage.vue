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
                    @next="nextStep"
                    @later="nextStep"
                />

                <!-- Step 3: Name and symbol, while the book comes down behind it -->
                <ProfileStep
                    v-if="currentStep === 3"
                    :is-syncing="isSyncing"
                    :download-started="downloadStarted"
                    :download-complete="downloadComplete"
                    :failed-count="failedFiles.length"
                    :sync-error="syncError"
                    :sync-progress="syncProgress"
                    :ask-first="askBeforeDownload && !downloadStarted && !downloadComplete"
                    @download="handleDownload"
                    @retry="handleRetry"
                    @finish="finishOnboarding"
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
import ProfileStep from '@/components/onboarding/ProfileStep.vue';
import StepIndicator from '@/components/utils/StepIndicator.vue';

import { type StorageSpace, getStorageEstimate } from '@/services/storage';
import { mayUseMobileData } from '@/utils/mobileData';

const router = useRouter();
const songsStore = useSongsStore();
const { isSyncing, error: syncError, syncProgress, failedFiles } = storeToRefs(songsStore);

const ONBOARDING_IN_PROGRESS_KEY = 'onboarding.inProgress';
const ONBOARDING_STEP_KEY = 'onboarding.currentStep';

// Step management
const totalSteps = 3;

/**
 * Where an onboarding cut off by a reload (or an installed app launched
 * fresh) left off. Read here, in setup, and not in onMounted: the step watcher
 * below runs at once and stores the step it starts on, so by the time the page
 * mounted it had already written „1" over the step it was meant to restore.
 */
function storedStep(): number {
    try {
        const step = Number(localStorage.getItem(ONBOARDING_STEP_KEY));
        return Number.isInteger(step) && step >= 1 && step <= totalSteps ? step : 1;
    } catch {
        return 1;
    }
}

const currentStep = ref(storedStep());

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

// On a phone the download waits to be asked for: the reader may be on mobile
// data and rather wait for WLAN, so the step quotes the transfer and leaves the
// moment to them. At a desk, or on a handheld that says it is on WLAN, there is
// nothing to ask, and the download starts as soon as the step is active.
// Guarded so re-entering the step never starts it twice, and an already fully
// synced library goes straight to the finished state.
const askBeforeDownload = mayUseMobileData();

function enterDownloadStep() {
    if (songsStore.isSyncing || downloadStarted.value) {
        return;
    }
    if (songsStore.hasSongs && songsStore.failedFiles.length === 0) {
        downloadComplete.value = true;
        return;
    }
    if (!askBeforeDownload) {
        void handleDownload();
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
    storage.value = await getStorageEstimate();
});

watch(
    currentStep,
    (step) => {
        localStorage.setItem(ONBOARDING_STEP_KEY, String(step));
        // The profile step too: a reload there (the download cut off with the
        // page) has to pick the book up again, or „Fertig" would send the
        // reader off with half of it.
        if (step >= 2) {
            enterDownloadStep();
        }
    },
    { immediate: true },
);
</script>
