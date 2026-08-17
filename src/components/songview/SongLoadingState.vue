<template>
    <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Spinner size="lg" />
        <p class="mt-4 text-muted-foreground">Lied wird geladen...</p>
    </div>
</template>

<script setup lang="ts">
import { Spinner } from '@/components/ui/spinner';
</script>
