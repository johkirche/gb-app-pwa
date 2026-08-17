<template>
    <ion-button
        expand="block"
        fill="clear"
        @click="handleSkip"
        :disabled="disabled"
        size="small"
        color="medium"
        class="ion-margin-top"
    >
        Überspringen (Entwicklermodus)
    </ion-button>
</template>

<script setup lang="ts">
// Dev-only auth bypass. This component is loaded exclusively via an
// import.meta.env.DEV-guarded dynamic import, so production builds never
// emit this chunk — neither the button markup nor the bypass handler ships.
import { IonButton } from '@ionic/vue';
import { useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';

defineProps<{ disabled?: boolean }>();

const router = useRouter();
const { setDevSkipAuth } = useAuth();

function handleSkip() {
    setDevSkipAuth(true);
    router.push('/tabs/lieder');
}
</script>
