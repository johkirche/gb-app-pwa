<template>
    <!-- Transitional: <ion-app> stays as the root container while Ionic views
         are migrated (their overlays and abs-positioned ion-pages mount against
         it). It becomes a plain wrapper div at the end of the migration. -->
    <ion-app>
        <router-view />
        <Toaster position="bottom-center" :theme="isDark ? 'dark' : 'light'" />
    </ion-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { IonApp } from '@ionic/vue';

import { useTheme } from '@/composables/useTheme';

import { Toaster } from '@/components/ui/sonner';

const { isDark, initTheme } = useTheme();

onMounted(() => {
    initTheme();
});
</script>
