<template>
    <Button
        type="button"
        variant="ghost"
        size="sm"
        class="mt-4 w-full text-muted-foreground"
        :disabled="disabled"
        @click="handleSkip"
    >
        Überspringen (Entwicklermodus)
    </Button>
</template>

<script setup lang="ts">
// Dev-only auth bypass. This component is loaded exclusively via an
// import.meta.env.DEV-guarded dynamic import, so production builds never
// emit this chunk — neither the button markup nor the bypass handler ships.
import { useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';

import { Button } from '@/components/ui/button';

defineProps<{ disabled?: boolean }>();

const router = useRouter();
const { setDevSkipAuth } = useAuth();

function handleSkip() {
    setDevSkipAuth(true);
    router.push('/tabs/lieder');
}
</script>
