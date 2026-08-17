<template>
    <div class="state-container empty-state">
        <ion-icon :icon="alertCircleOutline" size="large"></ion-icon>
        <h2>Lied nicht gefunden</h2>
        <p>Das angeforderte Lied konnte nicht gefunden werden.</p>
        <ion-button fill="outline" @click="$router.back()">Zurück</ion-button>
    </div>
</template>

<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue';
import { alertCircleOutline } from 'ionicons/icons';
</script>

<style scoped>
.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
}

.state-container > ion-icon {
    font-size: 64px;
    color: var(--ion-color-medium);
    margin-bottom: 16px;
}

.state-container h2 {
    margin: 0 0 8px;
    color: var(--ion-color-dark);
}

.state-container p {
    margin: 0 0 16px;
    color: var(--ion-color-medium);
}
</style>
