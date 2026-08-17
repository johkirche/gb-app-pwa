<template>
    <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
        <AlertCircle class="mb-4 size-16 text-muted-foreground" aria-hidden="true" />
        <h2 class="mb-2 font-display text-2xl font-semibold">Lied nicht gefunden</h2>
        <p class="mb-4 text-muted-foreground">
            Das angeforderte Lied konnte nicht gefunden werden.
        </p>
        <Button variant="outline" @click="$router.back()">Zurück</Button>
    </div>
</template>

<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';

import { Button } from '@/components/ui/button';
</script>
