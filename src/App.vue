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
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { useTheme } from '@/composables/useTheme';

import { ConfirmHost } from '@/components/ui/confirm';
import { Toaster } from '@/components/ui/sonner';

const { isDark, initTheme } = useTheme();

onMounted(() => {
    initTheme();
});
</script>
