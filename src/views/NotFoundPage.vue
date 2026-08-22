<template>
    <!-- No page header: an address that matches nothing has no page identity to
         put in one, and the heading below would only say it twice. -->
    <div class="flex h-full flex-col overflow-y-auto bg-background">
        <div
            class="page-col flex min-h-full flex-col items-center justify-center px-6 py-12 pt-[max(3rem,env(safe-area-inset-top))] text-center"
        >
            <Compass class="size-14 text-muted-foreground" stroke-width="1.25" aria-hidden="true" />
            <h1 class="mt-4 font-display text-2xl font-semibold">Seite nicht gefunden</h1>
            <p class="mt-2 max-w-96 text-sm text-muted-foreground">
                Diese Adresse gehört zu keiner Seite des Gesangbuchs. Möglicherweise stammt der Link
                aus einer älteren Version.
            </p>
            <p
                v-if="attemptedPath"
                class="mt-3 max-w-96 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground"
            >
                {{ attemptedPath }}
            </p>
            <Button class="mt-6" @click="router.replace('/tabs/lieder')">
                <Home aria-hidden="true" />
                Zu den Liedern
            </Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Compass, Home } from 'lucide-vue-next';
import { useRoute, useRouter } from 'vue-router';

import { Button } from '@/components/ui/button';

const route = useRoute();
const router = useRouter();

// Naming the address makes a mistyped or outdated link recognisable. It is
// rendered as text, never as a link.
const attemptedPath = computed(() => route.fullPath);
</script>
