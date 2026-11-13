<template>
    <!-- The status bar's inset out here, not on the content: what scrolls should stop
         below it, and the Gemeinde step's map stays at the top of what scrolls. -->
    <div class="flex h-full flex-col bg-background pt-[env(safe-area-inset-top)]">
        <main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
                class="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0rem,calc(1rem_-_env(safe-area-inset-top)))]"
            >
                <!-- Step Indicator Dots -->
                <StepIndicator
                    :current-step="currentStep"
                    :total-steps="totalSteps"
                    :first-step="firstStep"
                    @back="prevStep"
                />

                <!-- Step 1: Install PWA -->
                <InstallPWAStep v-if="currentStep === 1" @next="nextStep" @skip="skipOnboarding" />

                <!-- Step 2: Gemeinde. Before the download, because a download that
                     fails can be left for later, and that leaves the onboarding:
                     everything after it would go unasked. -->
                <GemeindeStep v-if="currentStep === GEMEINDE_STEP" @next="nextStep" />

                <!-- Step 3: Download Content -->
                <DownloadContentStep
                    v-if="currentStep === DOWNLOAD_STEP"
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
                    @skip="skipOnboarding"
                />

                <!-- Each slide of the tour is a step of its own, so there is one
                     row of dots to read and the back arrow goes back one slide. -->
                <TourStep
                    v-if="tourSlide"
                    :slide="tourSlide"
                    :is-last="currentStep === lastTourStep"
                    @next="nextStep"
                    @skip="currentStep = totalSteps"
                />

                <!-- Last: name and symbol -->
                <ProfileStep v-if="currentStep === totalSteps" @finish="finishOnboarding" />
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

import { useSongsStore } from '@/stores/songs';

import { usePWA } from '@/composables/usePWA';

import DownloadContentStep from '@/components/onboarding/DownloadContentStep.vue';
import GemeindeStep from '@/components/onboarding/GemeindeStep.vue';
import InstallPWAStep from '@/components/onboarding/InstallPWAStep.vue';
import ProfileStep from '@/components/onboarding/ProfileStep.vue';
import TourStep from '@/components/onboarding/TourStep.vue';
import { tourSlides } from '@/components/onboarding/tour';
import StepIndicator from '@/components/utils/StepIndicator.vue';

import { type StorageSpace, getStorageEstimate } from '@/services/storage';
import { mayUseMobileData } from '@/utils/mobileData';

const router = useRouter();
const songsStore = useSongsStore();
const { isSyncing, error: syncError, syncProgress, failedFiles } = storeToRefs(songsStore);

const ONBOARDING_IN_PROGRESS_KEY = 'onboarding.inProgress';
const ONBOARDING_STEP_KEY = 'onboarding.currentStep';

// Step management
// Install, Gemeinde, download, a step per slide of the tour, then the profile.
const GEMEINDE_STEP = 2;
const DOWNLOAD_STEP = 3;
const FIRST_TOUR_STEP = 4;
const TOUR = tourSlides();
const lastTourStep = FIRST_TOUR_STEP + TOUR.length - 1;
const totalSteps = lastTourStep + 1;

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

// Opened as the installed app, the onboarding has nothing left to install, so it
// starts at the Gemeinde. Whether this page runs as the app is the one question
// about installation a page can answer for certain — it is the display mode, not
// a guess — and it covers both ways in: an Android tab handing over to the app,
// which shares its storage and so brings the stored step 1 along, and an iPhone,
// whose home-screen app starts empty and comes here after a second login.
const { isStandalone } = usePWA();
const firstStep = isStandalone.value ? GEMEINDE_STEP : 1;

const currentStep = ref(Math.max(storedStep(), firstStep));

const tourSlide = computed(() => TOUR[currentStep.value - FIRST_TOUR_STEP] ?? null);

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
    if (currentStep.value > firstStep) {
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
// synced library goes straight to the finished state. Songs alone do not say
// that: a sync stores them first and the notation after, so a tab closed in
// between leaves the songs and no files. Only a finished sync writes lastSyncTime.
const askBeforeDownload = mayUseMobileData();

function enterDownloadStep() {
    if (songsStore.isSyncing || downloadStarted.value) {
        return;
    }
    if (songsStore.hasSongs && songsStore.lastSyncTime && songsStore.failedFiles.length === 0) {
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
        if (step === DOWNLOAD_STEP) {
            enterDownloadStep();
        }
    },
    { immediate: true },
);
</script>
