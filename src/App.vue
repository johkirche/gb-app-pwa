<template>
    <div class="h-full bg-background text-foreground">
        <router-view />
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
