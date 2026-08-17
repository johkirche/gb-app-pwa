<template>
    <Toaster
        v-bind="props"
        :toast-options="{
            classes: {
                toast: 'gb-toast',
            },
        }"
    />
</template>

<script setup lang="ts">
import { Toaster } from 'vue-sonner';

type ToasterProps = InstanceType<typeof Toaster>['$props'];

const props = defineProps<ToasterProps>();
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
