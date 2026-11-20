<template>
    <!-- Horizontal safe-area padding covers notched devices in landscape
         (Ionic used to derive this automatically) -->
    <div
        class="h-full bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-foreground"
    >
        <!-- Keep the tab shell (and its inner per-tab KeepAlive) alive while
             standalone routes like /songs/:id are open, so list state survives
             the round trip — parity with Ionic's router outlet. -->
        <router-view v-slot="{ Component }">
            <keep-alive :include="['TabsPage']">
                <component :is="Component" />
            </keep-alive>
        </router-view>
        <Toaster position="bottom-center" :theme="isDark ? 'dark' : 'light'" />
        <ConfirmHost />
        <component :is="ViewportPreview" v-if="ViewportPreview" />
    </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, watch } from 'vue';

import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';

import { usePreferencesStore } from '@/stores/preferences';
import { useSongsStore } from '@/stores/songs';
import { useUserStore } from '@/stores/user';

import { useAkzent } from '@/composables/useAkzent';
import { syncMidiPreference } from '@/composables/useMidiOutput';
import { usePageScale } from '@/composables/usePageScale';
import { useProfile } from '@/composables/useProfile';
import { useTheme } from '@/composables/useTheme';

import { ConfirmHost } from '@/components/ui/confirm';
import { Toaster } from '@/components/ui/sonner';

import { clearSessionData } from '@/services/errorHandler';
import { startLibraryUpdates } from '@/services/libraryUpdates';
import { fristHinweis, offlineFrist } from '@/services/offlineFrist';
import { refreshAuthToken } from '@/services/session';
import { requestPersistentStorage } from '@/services/storage';
import { startUserDataSync } from '@/services/userData/sync';

// Mobile-viewport preview. Always available in dev; a production build ships
// it only when VITE_SHOW_VIEWPORT_PREVIEW is 'true'. Both values are statically
// replaced by Vite, so an unflagged build folds the ternary to null and the
// chunk never gets emitted (same pattern as DevSkipButton).
const showViewportPreview =
    import.meta.env.DEV || import.meta.env.VITE_SHOW_VIEWPORT_PREVIEW === 'true';
const ViewportPreview = showViewportPreview
    ? defineAsyncComponent(() => import('@/components/dev/DevViewportPreview.vue'))
    : null;

const { isDark, initTheme } = useTheme();
const { initAkzent, pullAkzentFromProfile } = useAkzent();
const { pullProfile } = useProfile();

// Bring the MIDI device layer in line with what was saved. Only a permission
// that already stands is re-used — this never raises a prompt, so a reader who
// has never asked for MIDI never hears about it. Watched rather than read once:
// the preferences load asynchronously, and the settings page writes here too.
const preferencesStore = usePreferencesStore();

// Größe is the whole app's, not the song page's: hung on the root element here,
// so the Liederliste, the Playlisten and the Einstellungen grow with the song
// page instead of staying at whatever size they were built at.
usePageScale();

watch(
    () => [preferencesStore.midiOutputEnabled, preferencesStore.midiOutputId] as const,
    ([enabled, deviceId]) => {
        void syncMidiPreference(enabled, deviceId);
    },
    { immediate: true },
);

const router = useRouter();
const userStore = useUserStore();

// A demo library (see worker/demo.ts) is brought up to date on every cold
// start and every return to the app — and taken back once its link has
// closed, which ends on the page that says what the whole book holds. Not on
// the demo page itself, which is loading the same thing in the foreground.
const songsStore = useSongsStore();

watch(
    () => songsStore.demoClosed,
    (closed) => {
        if (!closed) return;
        songsStore.acknowledgeDemoClosed();
        void router.replace({ name: 'DemoEnd' });
    },
);

// The book closes when its session ends: the server refused the renewal (the
// device was signed out from another one, the account suspended), or thirty
// days passed without one. The songs, lists and marks stay; the sign-in greets
// the reader back and asks for a code. The guard keeps the book closed on the
// next navigation; this takes the reader there from the page they were on.
// A logout leads there by itself, and a demo has no session to lose.
watch(
    () => userStore.isLoggedIn,
    (loggedIn, was) => {
        if (loggedIn || !was) return;
        const route = router.currentRoute.value;
        if (route.meta.access === 'public' || songsStore.isDemo) return;
        void router.replace({ name: 'Anmelden' });
    },
);

/** Too long without the server, noticed while the app stayed open. */
async function closeIfPastGrace() {
    if (!userStore.authData || !userStore.isPastGrace()) return;
    await clearSessionData();
    userStore.endSession();
}

const FRIST_HINWEIS_KEY = 'gesangbuch.fristHinweis';

/**
 * The time the book may go without the server running out (services/
 * offlineFrist). The server is asked first: with a connection the session
 * renews, or the server ends it and the reader is taken to the code, and
 * either way there is nothing to remind of. Without one the reader hears when
 * the book needs a connection, once a day, and the notice stays until it is
 * swiped away: a reminder that times out is gone before anyone looks.
 */
async function remindOfflineFrist() {
    const state = offlineFrist(userStore.authData?.refreshExpiresAt).state;
    if (state !== 'bald' && state !== 'nachfrist') return;
    await refreshAuthToken();
    if (!userStore.authData) return;

    const hint = fristHinweis(offlineFrist(userStore.authData.refreshExpiresAt));
    if (!hint) return;
    const today = new Date().toDateString();
    try {
        if (localStorage.getItem(FRIST_HINWEIS_KEY) === today) return;
        localStorage.setItem(FRIST_HINWEIS_KEY, today);
    } catch {
        // Without storage it may say so more than once a day.
    }
    toast.info(hint.title, { description: hint.description, duration: Infinity });
}

// The profile's Akzent comes down on every login and every cold start with a
// session, so a color chosen on one device follows the reader to the next.
watch(
    () => userStore.isLoggedIn,
    (loggedIn) => {
        if (!loggedIn) return;
        void pullAkzentFromProfile();
        // The name and symbol may have changed on another device, and a fresh
        // login brings neither picture of the symbol with it.
        void pullProfile();
    },
    { immediate: true },
);

onMounted(async () => {
    initTheme();
    initAkzent();
    // The reader's lists, marks and settings, kept on the account.
    startUserDataSync();

    await Promise.all([songsStore.initPromise, router.isReady()]);
    // Whatever was corrected on the server since the last sync.
    startLibraryUpdates();
    // Asked on every start with a book to protect, not only when a download
    // runs: Chrome decides by how the app is used, and may say yes to an
    // installed, much-opened app it turned down on the first day. Without it, a
    // full phone empties IndexedDB. Not without a book: there is nothing to keep
    // yet, the download asks when it runs, and headless Chromium hangs a second
    // tab that asks at the same moment as the first (session.spec.ts).
    if (songsStore.hasSongs) void requestPersistentStorage();
    void remindOfflineFrist();
    refreshDemo();
    // An installed app on a phone is rarely started cold: it comes back from
    // the background, days later, where the event left it. That return is when
    // a closed demo has to notice. The shell lives as long as the page does, so
    // the listener is never taken down.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        refreshDemo();
        void closeIfPastGrace().then(remindOfflineFrist);
    });
});

function refreshDemo() {
    if (songsStore.demoKey && !userStore.isLoggedIn && router.currentRoute.value.name !== 'Demo') {
        void songsStore.refreshDemo();
    }
}
</script>
