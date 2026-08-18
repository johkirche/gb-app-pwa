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
import { defineAsyncComponent, onMounted } from 'vue';

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

onMounted(() => {
    initTheme();
});
</script>
