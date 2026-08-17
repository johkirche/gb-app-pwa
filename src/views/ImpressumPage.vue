<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button default-href="/login" text=""></ion-back-button>
                </ion-buttons>
                <ion-title>Impressum</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true">
            <div class="content-container card-stack">
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Angaben gemäß § 5 DDG</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <h3>Anbieter</h3>
                        <p class="legal-todo">[TODO: Von der Organisation zu ergänzen]</p>

                        <h3>Anschrift</h3>
                        <p class="legal-todo">[TODO: Von der Organisation zu ergänzen]</p>

                        <h3>Vertretungsberechtigte</h3>
                        <p class="legal-todo">[TODO: Von der Organisation zu ergänzen]</p>
                    </ion-card-content>
                </ion-card>

                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Kontakt</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <h3>E-Mail</h3>
                        <p>
                            <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>
                        </p>

                        <h3>Telefon</h3>
                        <p class="legal-todo">[TODO: Von der Organisation zu ergänzen]</p>
                    </ion-card-content>
                </ion-card>

                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Verantwortlich für den Inhalt</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p class="legal-todo">[TODO: Von der Organisation zu ergänzen]</p>
                    </ion-card-content>
                </ion-card>
            </div>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import {
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
} from '@ionic/vue';

import { SUPPORT_EMAIL } from '@/config/support';
</script>

<style scoped>
ion-card-content h3 {
    font-weight: 600;
    margin-top: var(--spacing-md, 16px);
    margin-bottom: 4px;
}

ion-card-content h3:first-child {
    margin-top: 0;
}

ion-card-content p {
    line-height: 1.6;
}

/* Placeholder entries that must be completed by the organisation before release */
.legal-todo {
    color: var(--ion-color-warning-shade);
    font-style: italic;
}
</style>
