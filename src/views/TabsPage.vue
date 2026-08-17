<template>
    <ion-page>
        <ion-tabs>
            <ion-router-outlet></ion-router-outlet>
            <ion-tab-bar slot="bottom">
                <ion-tab-button tab="lieder" href="/tabs/lieder">
                    <ion-icon :icon="musicalNotesOutline"></ion-icon>
                    <ion-label>Lieder</ion-label>
                </ion-tab-button>
                <ion-tab-button tab="playlisten" href="/tabs/playlisten">
                    <ion-icon :icon="discOutline"></ion-icon>
                    <ion-label>Playlisten</ion-label>
                </ion-tab-button>
                <!-- Future tab (Gottesdienst): add an ion-tab-button here plus a child route under /tabs/ -->
                <ion-tab-button tab="einstellungen" href="/tabs/einstellungen">
                    <ion-icon :icon="settingsOutline"></ion-icon>
                    <ion-label>Einstellungen</ion-label>
                </ion-tab-button>
            </ion-tab-bar>
        </ion-tabs>
    </ion-page>
</template>

<script setup lang="ts">
import {
    IonIcon,
    IonLabel,
    IonPage,
    IonRouterOutlet,
    IonTabBar,
    IonTabButton,
    IonTabs,
} from '@ionic/vue';
import { discOutline, musicalNotesOutline, settingsOutline } from 'ionicons/icons';
</script>
