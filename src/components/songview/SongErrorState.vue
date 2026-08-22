<template>
    <div class="flex min-h-full flex-col items-center justify-center px-6 py-12 text-center">
        <AlertCircle class="mb-4 size-16 text-muted-foreground" aria-hidden="true" />
        <h2 class="mb-2 font-display text-2xl font-semibold">Lied nicht gefunden</h2>
        <p class="mb-6 max-w-96 text-muted-foreground">
            Das angeforderte Lied konnte nicht gefunden werden. Vielleicht wurde es entfernt oder es
            ist noch nicht heruntergeladen.
        </p>
        <!-- Both ways out, because neither works everywhere: a directly opened
             URL has nothing to go back to, and inside the app the list is not
             always where the reader came from. -->
        <div class="flex flex-wrap items-center justify-center gap-3">
            <Button @click="router.replace('/tabs/lieder')">
                <Home aria-hidden="true" />
                Zu den Liedern
            </Button>
            <Button v-if="canGoBack" variant="outline" @click="goBack">Zurück</Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { AlertCircle, Home } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { useBackNav } from '@/composables/useBackNav';

import { Button } from '@/components/ui/button';

const router = useRouter();
const { goBack } = useBackNav('/tabs/lieder');

// A song opened straight from a link (or from the installed app's start URL)
// has no history behind it — offering "Zurück" there would be the dead end
// this state exists to avoid.
const canGoBack = window.history.state?.back != null;
</script>
