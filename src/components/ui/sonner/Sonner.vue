<template>
    <Toaster
        :theme="theme"
        :position="position"
        :offset="offset"
        :mobile-offset="mobileOffset"
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

/**
 * A toast is fixed to the viewport, so at the bottom it lands on whatever the
 * app puts along that edge — the tab bar, on phones. `--app-bottom-inset` says
 * how tall that is (see `useBottomBarInset`); the rest is sonner's own gap.
 */
const offset = { bottom: 'calc(var(--app-bottom-inset, 0px) + 24px)' };

/**
 * Below 600px sonner adds the bottom safe area to whatever offset it is given,
 * and the inset counts that area already — as the bar's own padding. Take it
 * off here so the two do not stack into a gap twice the size.
 */
const mobileOffset = {
    bottom: 'calc(var(--app-bottom-inset, 0px) + 16px - max(env(safe-area-inset-bottom), 0px))',
};
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
