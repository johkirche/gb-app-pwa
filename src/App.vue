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
import { useTheme } from '@/composables/useTheme';

import { ConfirmHost } from '@/components/ui/confirm';
import { Toaster } from '@/components/ui/sonner';

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

// A session that lapses no longer interrupts anything: the reader stays on the
// page they were on, with the whole downloaded Gesangbuch intact (see
// `handleInvalidCredentials`). But it must not lapse *silently* either, or the
// next sync would fail for no visible reason — so the shell says it once, here,
// where every route can be reached from.
const router = useRouter();
const userStore = useUserStore();

watch(
    () => userStore.sessionExpired,
    (expired) => {
        if (!expired) return;
        userStore.acknowledgeSessionExpired();
        toast.info('Ihre Sitzung ist abgelaufen.', {
            description:
                'Ihr heruntergeladenes Gesangbuch bleibt nutzbar. Zum Synchronisieren melden Sie sich bitte wieder an.',
            duration: 8000,
            action: { label: 'Anmelden', onClick: () => router.push('/login') },
        });
    },
);

// A demo library (see worker/demo.ts) is brought up to date on every cold
// start — and taken back once its link has closed. Not on the demo page itself,
// which is loading the same thing in the foreground.
const songsStore = useSongsStore();

watch(
    () => songsStore.demoClosed,
    (closed) => {
        if (!closed) return;
        songsStore.acknowledgeDemoClosed();
        toast.info('Die Vorschau ist beendet.', {
            description: 'Vielen Dank fürs Ausprobieren des neuen Gesangbuchs.',
            duration: 8000,
        });
        void router.replace('/login');
    },
);

// The profile's Akzent comes down on every login and every cold start with a
// session, so a color chosen on one device follows the reader to the next.
watch(
    () => userStore.isLoggedIn,
    (loggedIn) => {
        if (loggedIn) void pullAkzentFromProfile();
    },
    { immediate: true },
);

onMounted(async () => {
    initTheme();
    initAkzent();

    await Promise.all([songsStore.initPromise, router.isReady()]);
    if (songsStore.demoKey && !userStore.isLoggedIn && router.currentRoute.value.name !== 'Demo') {
        void songsStore.refreshDemo();
    }
});
</script>
