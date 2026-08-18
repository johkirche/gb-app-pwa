<template>
    <Toaster
        :theme="theme"
        :position="position"
        :toast-options="{
            classes: {
                toast: 'gb-toast',
            },
        }"
    />
</template>

<script setup lang="ts">
import { Toaster } from 'vue-sonner';

interface Props {
    theme?: 'light' | 'dark' | 'system';
    position?:
        | 'top-left'
        | 'top-center'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-center'
        | 'bottom-right';
}

withDefaults(defineProps<Props>(), {
    theme: 'system',
    position: 'bottom-center',
});
</script>

<style>
/* Token-driven look for vue-sonner toasts (matches the design system) */
.gb-toast {
    background: var(--popover) !important;
    color: var(--popover-foreground) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--radius) !important;
    font-family: var(--font-sans) !important;
}
</style>
