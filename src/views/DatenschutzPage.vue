<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button default-href="/login" text=""></ion-back-button>
                </ion-buttons>
                <ion-title>Datenschutzerklärung</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true">
            <div class="content-container card-stack">
                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Verantwortlicher</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p class="legal-todo">
                            [TODO: Von der Organisation zu ergänzen – Name und Anschrift des
                            Verantwortlichen im Sinne der DSGVO sowie ggf. Kontaktdaten des
                            Datenschutzbeauftragten.]
                        </p>
                        <p>
                            Kontakt:
                            <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>
                        </p>
                    </ion-card-content>
                </ion-card>

                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Überblick</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p>
                            Diese App ist ein digitales Gesangbuch, das nach dem Herunterladen der
                            Inhalte weitgehend offline funktioniert. Personenbezogene Daten werden
                            nur verarbeitet, soweit dies für die Anmeldung und die Bereitstellung
                            der Inhalte erforderlich ist. Die App setzt keine Analyse- oder
                            Tracking-Dienste ein und stellt keine Anfragen an Drittanbieter.
                        </p>
                    </ion-card-content>
                </ion-card>

                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Lokal auf Ihrem Gerät gespeicherte Daten</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p>
                            Damit die App offline nutzbar ist, speichert sie Daten ausschließlich
                            lokal auf Ihrem Gerät:
                        </p>
                        <ul>
                            <li>
                                <strong>App-Datenbank</strong>
                                (IndexedDB &bdquo;GesangbuchDB&ldquo;): Lieder und Notendateien
                                (Tabellen
                                <em>songs</em>
                                ,
                                <em>files</em>
                                ), Anmelde- und Sitzungsdaten (
                                <em>auth</em>
                                ), Profildaten wie E-Mail-Adresse, Name und Rolle (
                                <em>users</em>
                                ), Playlists (
                                <em>playlists</em>
                                ), Darstellungs-Einstellungen (
                                <em>preferences</em>
                                ), Favoriten (
                                <em>favorites</em>
                                ) sowie Synchronisierungs-Metadaten (
                                <em>meta</em>
                                ).
                            </li>
                            <li>
                                <strong>Browser-Speicher</strong>
                                (localStorage): das gewählte Farbschema (
                                <em>settings.theme</em>
                                ) und der Fortschritt der Ersteinrichtung (
                                <em>onboarding.inProgress</em>
                                ,
                                <em>onboarding.currentStep</em>
                                ).
                            </li>
                            <li>
                                <strong>Service-Worker-Caches</strong>
                                : die App-Dateien selbst (Workbox-Precache, einschließlich der
                                Klangdateien für die Notenwiedergabe) sowie die Caches
                                <em>api-cache</em>
                                ,
                                <em>image-cache</em>
                                und
                                <em>font-cache</em>
                                .
                            </li>
                        </ul>
                        <p>
                            Diese Daten verbleiben auf Ihrem Gerät und werden nicht an Dritte
                            übermittelt. Beim Abmelden werden Sitzungsdaten sowie Ihre persönlichen
                            Daten (Playlists, Favoriten, Einstellungen) von diesem Gerät entfernt;
                            bei einer Kontolöschung werden sämtliche lokal gespeicherten Daten
                            gelöscht.
                        </p>
                    </ion-card-content>
                </ion-card>

                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Server-Anfragen</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p>
                            Die App kommuniziert ausschließlich mit dem für sie konfigurierten
                            Backend der Johannischen Kirche (gb26-admin.johannische-kirche.org).
                            Dabei werden folgende Schnittstellen verwendet:
                        </p>
                        <ul>
                            <li>
                                <em>/auth/&hellip;</em>
                                &ndash; Anmeldung, Sitzungsverlängerung, Abmeldung und Zurücksetzen
                                des Passworts
                            </li>
                            <li>
                                <em>/graphql</em>
                                &ndash; Abruf der Liederdaten
                            </li>
                            <li>
                                <em>/assets/&hellip;</em>
                                &ndash; Abruf der Notendateien
                            </li>
                            <li>
                                <em>/users/&hellip;</em>
                                &ndash; Abruf der eigenen Profildaten und Kontolöschung
                            </li>
                            <li>
                                <em>/directus-user-register-extension/&hellip;</em>
                                &ndash; Registrierung mit Aktivierungscode
                            </li>
                        </ul>
                        <p>
                            Anmeldungen und andere Anfragen an das Backend können dort im Rahmen der
                            üblichen serverseitigen Protokollierung erfasst werden.
                        </p>
                    </ion-card-content>
                </ion-card>

                <ion-card>
                    <ion-card-header>
                        <ion-card-title>Keine Drittanbieter</ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p>
                            Die Notenwiedergabe lädt die benötigten Klangdateien (Soundfonts) von
                            derselben Quelle wie die App selbst; es finden dabei keine Anfragen an
                            Drittanbieter statt. Die App setzt keine Cookies zu Werbe- oder
                            Analysezwecken und keine Tracking-Dienste ein.
                        </p>
                    </ion-card-content>
                </ion-card>

                <ion-card>
                    <ion-card-header>
                        <ion-card-title>
                            Rechtsgrundlagen, Speicherdauer und Ihre Rechte
                        </ion-card-title>
                    </ion-card-header>
                    <ion-card-content>
                        <p class="legal-todo">
                            [TODO: Von der Organisation zu ergänzen – u.&nbsp;a. Rechtsgrundlagen
                            der Verarbeitung, Speicherdauer der serverseitig gespeicherten Daten
                            sowie die Betroffenenrechte (Auskunft, Berichtigung, Löschung,
                            Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei
                            einer Aufsichtsbehörde).]
                        </p>
                        <p class="legal-todo">[TODO: Stand dieser Erklärung ergänzen]</p>
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
ion-card-content p,
ion-card-content li {
    line-height: 1.6;
}

ion-card-content p + p {
    margin-top: var(--spacing-sm, 8px);
}

ion-card-content ul {
    margin: var(--spacing-sm, 8px) 0;
    padding-left: 20px;
}

ion-card-content li + li {
    margin-top: 4px;
}

/* Placeholder entries that must be completed by the organisation before release */
.legal-todo {
    color: var(--ion-color-warning-shade);
    font-style: italic;
}
</style>
