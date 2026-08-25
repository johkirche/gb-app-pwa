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
import { useUserStore } from '@/stores/user';

import { syncMidiPreference } from '@/composables/useMidiOutput';
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

// Bring the MIDI device layer in line with what was saved. Only a permission
// that already stands is re-used — this never raises a prompt, so a reader who
// has never asked for MIDI never hears about it. Watched rather than read once:
// the preferences load asynchronously, and the settings page writes here too.
const preferencesStore = usePreferencesStore();
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

onMounted(() => {
    initTheme();
});
</script>
